/* pr-starmap's star map score, generated live rather than played from a
   recording: a drone, a shimmer, a far engine room, pings on an echo line, and
   a tension voice that rises with the number of blocked pull requests, so a
   backlog sounds uneasy and clearing it lets the sky settle. */

/** The score as the page drives it; behind an interface so tests need no audio device. */
export interface StarmapScore {
  start(): Promise<void>;
  stop(): void;
  /** How many things are blocked right now; the tension voice follows it. */
  setTension(blocked: number): void;
  /** 0 to 1, as the slider gives it. */
  setVolume(volume: number): void;
  /** A soft tone for a chosen star: lower and darker when it is stuck. */
  ping(stuck: boolean, pr: number): void;
}

/** Loudness is heard as the square of the slider, so the gain follows it. */
export const gainFor = (volume: number): number => volume * volume * 2.4;

/** Twelve or more blocked is as uneasy as it gets; one is barely there. */
export const tensionGainFor = (blocked: number): number => (Math.min(blocked, 12) / 12) * 0.045;

/** A major pentatonic has no semitone clashes, so random notes from it never sound wrong. */
export const SCALE = [440, 493.88, 554.37, 659.25, 739.99, 880, 987.77] as const;

interface Parts {
  readonly master: GainNode;
  readonly out: GainNode;
  readonly bus: GainNode;
  readonly delay: DelayNode;
  readonly tensionGain: GainNode;
}

export class WebAudioStarmapScore implements StarmapScore {
  private ac: AudioContext | null = null;
  private parts: Parts | null = null;
  private on = false;
  private tension = 0;
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

  setTension(blocked: number): void {
    this.tension = blocked;
    this.applyTension();
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

  private osc(ac: AudioContext, type: OscillatorType, freq: number, detune = 0): OscillatorNode {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.start();
    return o;
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

    // The drone: two detuned saws, filtered dark, the filter drifting on a forty-second breath.
    const padFilter = ac.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 380;
    padFilter.Q.value = 3.5;
    const padGain = ac.createGain();
    padGain.gain.value = 0.14;
    padFilter.connect(padGain).connect(bus);
    for (const [type, f, det] of [
      ['sawtooth', 55, -8],
      ['sawtooth', 55, 8],
      ['triangle', 82.41, -3],
      ['sine', 110, 4],
    ] as const) {
      this.osc(ac, type, f, det).connect(padFilter);
    }
    const sweep = this.osc(ac, 'sine', 0.025);
    const sweepAmt = ac.createGain();
    sweepAmt.gain.value = 240;
    sweep.connect(sweepAmt).connect(padFilter.frequency);

    // The shimmer: high partials fading in and out, sent only to the reverb, as distance.
    const shimmer = ac.createGain();
    shimmer.gain.value = 0.018;
    shimmer.connect(verb);
    [880, 1318.5, 1760, 2637].forEach((f, i) => {
      const g = ac.createGain();
      g.gain.value = 0;
      this.osc(ac, 'sine', f).connect(g).connect(shimmer);
      const lfo = this.osc(ac, 'sine', 0.04 + i * 0.021);
      const amt = ac.createGain();
      amt.gain.value = 0.5;
      lfo.connect(amt).connect(g.gain);
    });

    // Brown noise, low-passed: a far engine room under everything.
    const nbuf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
    const nd = nbuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < nd.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      nd[i] = last * 3.4;
    }
    const noise = ac.createBufferSource();
    noise.buffer = nbuf;
    noise.loop = true;
    const nf = ac.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 170;
    const ng = ac.createGain();
    ng.gain.value = 0.07;
    noise.connect(nf).connect(ng).connect(bus);
    noise.start();

    // The tension voice: a tritone above the root, the interval music uses for
    // "unresolved". Silent until something is blocked.
    const tensionGain = ac.createGain();
    tensionGain.gain.value = 0;
    this.osc(ac, 'triangle', 77.78, -5).connect(tensionGain);
    this.osc(ac, 'sawtooth', 155.56, 6).connect(tensionGain);
    tensionGain.connect(padFilter);

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

    this.parts = { master, out, bus, delay, tensionGain };
    this.applyTension();
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

  private applyTension(): void {
    const { ac, parts } = this;
    if (!ac || !parts) return;
    parts.tensionGain.gain.setTargetAtTime(tensionGainFor(this.tension), ac.currentTime, 2.5);
  }
}
