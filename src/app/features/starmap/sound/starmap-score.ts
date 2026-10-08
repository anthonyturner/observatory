import { noiseBurst, pluck, thump } from '../../../core/sound/instruments';
import { Rig } from '../../../core/sound/sound-rig';
import { MergeCue } from '../memory/merge-supernova';
import { crackleOf } from './meteor-crackle';

/* The star map's sound, generated live rather than played from a recording.
   Space carries no sound, so nothing holds in the background: the sky is quiet
   until something happens on it, and then plays a ping, a crackle, a beep or a
   boom, through a shared room and an echo line. */

/** The score as the page drives it; behind an interface so tests need no audio device. */
export interface StarmapScore {
  start(): Promise<void>;
  stop(): void;
  /** 0 to 1, as the slider gives it. */
  setVolume(volume: number): void;
  /** A soft tone for a chosen star: lower and darker when it is stuck. */
  ping(stuck: boolean, pr: number): void;
  /** A short quiet crackle for a meteor landing; `pan` is −1 (left) to 1 (right). */
  crackle(pan: number, strength: number, seed: number): void;
  /** A short, soft satellite beep at `hz`, panned -1 (left) to 1 (right). */
  beep(pan: number, hz: number): void;
  /** A deep boom and a fading shimmer for a merge, after the cue's delay, panned by it. */
  merge(cue: MergeCue): void;
}

/** Loudness is heard as the square of the slider, so the gain follows it. */
export const gainFor = (volume: number): number => volume * volume * 2.4;

/** A major pentatonic has no semitone clashes, so random notes from it never sound wrong. */
export const SCALE = [440, 493.88, 554.37, 659.25, 739.99, 880, 987.77] as const;

/** Satellite beeps are brief and quiet: heard as a sky's company, never as an alert. */
const BEEP_LEVEL = 0.035;
const BEEP_SECONDS = 0.09;

/** The boom's levels: the loudest thing the sky plays. */
const BOOM = { thump: 0.4, rumble: 0.14 } as const;

/** An A major arpeggio climbing from A5, each note softer than the last. */
const SHIMMER = [
  { midi: 81, lag: 0.16, level: 0.05 },
  { midi: 85, lag: 0.3, level: 0.04 },
  { midi: 88, lag: 0.46, level: 0.03 },
  { midi: 93, lag: 0.64, level: 0.02 },
] as const;

interface Parts {
  readonly master: GainNode;
  readonly out: GainNode;
  readonly bus: GainNode;
  readonly delay: DelayNode;
  readonly noise: AudioBuffer;
}

export class WebAudioStarmapScore implements StarmapScore {
  private ac: AudioContext | null = null;
  private parts: Parts | null = null;
  private on = false;
  private volume = 0.7;
  private blipTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly makeContext: () => AudioContext = () => new AudioContext()) {}

  async start(): Promise<void> {
    if (!this.ac) this.build();
    const { ac, parts } = this;
    if (!ac || !parts) return;
    if (ac.state === 'suspended') await ac.resume();
    this.on = true;
    parts.master.gain.cancelScheduledValues(ac.currentTime);
    parts.master.gain.setTargetAtTime(1, ac.currentTime, 1.4);
    this.schedule();
  }

  stop(): void {
    this.on = false;
    if (this.blipTimer) clearTimeout(this.blipTimer);
    const { ac, parts } = this;
    if (!ac || !parts) return;
    parts.master.gain.setTargetAtTime(0, ac.currentTime, 0.35);
    setTimeout(() => {
      if (!this.on && ac.state === 'running') void ac.suspend();
    }, 1800);
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    // A short glide, so dragging the slider never clicks.
    if (this.parts && this.ac) {
      this.parts.out.gain.setTargetAtTime(gainFor(this.volume), this.ac.currentTime, 0.04);
    }
  }

  ping(stuck: boolean, pr: number): void {
    this.blip(
      stuck ? 220 : (SCALE[pr % SCALE.length] ?? 659.25),
      stuck ? 0.05 : 0.04,
      stuck ? 1.4 : 1,
    );
  }

  /** A few ticks of high-passed noise, each softer than the last: embers dying. */
  crackle(pan: number, strength: number, seed: number): void {
    const { ac, parts } = this;
    if (!this.on || !ac || !parts) return;
    const rig = this.rigOf(ac, parts);
    const now = ac.currentTime;
    for (const pop of crackleOf(strength, seed)) {
      noiseBurst(rig, {
        at: now + pop.at,
        type: 'highpass',
        freq: pop.freq,
        q: 1.2,
        level: pop.level,
        decay: pop.decay,
        pan,
      });
    }
  }

  beep(pan: number, hz: number): void {
    const { ac, parts } = this;
    if (!this.on || !ac || !parts) return;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz;
    // Filtered to its own pitch: a thin, clipped beep rather than a bare tone.
    const tone = ac.createBiquadFilter();
    tone.type = 'bandpass';
    tone.frequency.value = hz;
    tone.Q.value = 6;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(BEEP_LEVEL, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + BEEP_SECONDS);
    const panner = ac.createStereoPanner();
    panner.pan.value = Math.min(1, Math.max(-1, pan));
    o.connect(tone).connect(g).connect(panner).connect(parts.master);
    o.start(t);
    o.stop(t + BEEP_SECONDS + 0.05);
  }

  /** A low thump and a rumble, then a few bright notes of the key falling away. */
  merge({ delayS, pan }: MergeCue): void {
    const { ac, parts } = this;
    if (!this.on || !ac || !parts) return;
    const rig = this.rigOf(ac, parts);
    const at = ac.currentTime + delayS;
    thump(rig, at, BOOM.thump, pan);
    noiseBurst(rig, { at, type: 'lowpass', freq: 140, level: BOOM.rumble, decay: 1.1, pan });
    SHIMMER.forEach(({ midi, lag, level }) =>
      pluck(rig, { at: at + lag, midi, severity: 'clear', pan, level }),
    );
  }

  /** The graph the shared instruments play into. */
  private rigOf(ac: AudioContext, parts: Parts): Rig {
    return {
      context: ac,
      master: parts.master,
      bus: parts.bus,
      echo: parts.delay,
      noise: parts.noise,
      out: parts.out,
    };
  }

  /** A room made of decaying noise: five seconds of it reads as space. */
  private impulse(ac: AudioContext, seconds: number, decay: number): AudioBuffer {
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private build(): void {
    const ac = this.makeContext();
    this.ac = ac;
    const master = ac.createGain();
    master.gain.value = 0;
    // A compressor last, so a stack of echoes can never spike the volume.
    const limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 6;
    // Volume after the limiter, so turning it up is louder rather than more compressed.
    const out = ac.createGain();
    out.gain.value = gainFor(this.volume);
    master.connect(limiter).connect(out).connect(ac.destination);

    const verb = ac.createConvolver();
    verb.buffer = this.impulse(ac, 5, 2.6);
    const wet = ac.createGain();
    wet.gain.value = 0.6;
    verb.connect(wet).connect(master);
    const bus = ac.createGain();
    const dry = ac.createGain();
    dry.gain.value = 0.55;
    bus.connect(dry).connect(master);
    bus.connect(verb);

    // An echo line for the pings, high-passed so repeats stay airy.
    const delay = ac.createDelay(2);
    delay.delayTime.value = 0.42;
    const feedback = ac.createGain();
    feedback.gain.value = 0.36;
    const airy = ac.createBiquadFilter();
    airy.type = 'highpass';
    airy.frequency.value = 650;
    delay.connect(airy).connect(feedback).connect(delay);
    delay.connect(bus);

    const whiteNoise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const wd = whiteNoise.getChannelData(0);
    for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;

    this.parts = { master, out, bus, delay, noise: whiteNoise };
  }

  private blip(freq: number, level: number, length = 1): void {
    const { ac, parts } = this;
    if (!this.on || !ac || !parts) return;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.006, t + 0.4);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9 * length);
    o.connect(g);
    g.connect(parts.bus);
    g.connect(parts.delay);
    o.start(t);
    o.stop(t + length + 0.1);
  }

  /** Pings arrive unannounced, every five to fourteen seconds. */
  private schedule(): void {
    if (this.blipTimer) clearTimeout(this.blipTimer);
    if (!this.on) return;
    this.blipTimer = setTimeout(
      () => {
        this.blip(SCALE[Math.floor(Math.random() * SCALE.length)], 0.02 + Math.random() * 0.02);
        this.schedule();
      },
      4500 + Math.random() * 9500,
    );
  }
}
