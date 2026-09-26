/** The audio graph every note plays into, shared by the scores. */
export interface Rig {
  readonly context: AudioContext;
  /** Faded in and out as the score starts and stops. */
  readonly master: GainNode;
  /** Dry and into the reverb. */
  readonly bus: AudioNode;
  /** Into the echo, and on to the bus. */
  readonly echo: AudioNode;
  readonly noise: AudioBuffer;
}

/** The room a score plays in. */
export interface RoomShape {
  readonly reverbS: number;
  /** How steeply the reverb's tail decays. */
  readonly reverbDecay: number;
  readonly wet: number;
  readonly echoS: number;
  readonly echoFeedback: number;
  /** The echo keeps only what is above this, so it never muddies the bass. */
  readonly echoFloorHz: number;
  readonly echoLevel: number;
  /** After the limiter: turning up is louder rather than just more squashed. */
  readonly outLevel: number;
}

export const SILENT = 0.0001;

/** Reverb for everything, an echo for what asks for it, a limiter last. */
export function buildRig(room: RoomShape): Rig {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.ratio.value = 8;
  const out = context.createGain();
  out.gain.value = room.outLevel;
  master.connect(limiter).connect(out).connect(context.destination);

  const reverb = context.createConvolver();
  reverb.buffer = decayingNoise(context, room.reverbS, room.reverbDecay);
  const wet = context.createGain();
  wet.gain.value = room.wet;
  reverb.connect(wet).connect(master);
  const bus = context.createGain();
  bus.connect(master);
  bus.connect(reverb);

  const delay = context.createDelay(2);
  delay.delayTime.value = room.echoS;
  const feedback = context.createGain();
  feedback.gain.value = room.echoFeedback;
  const airy = context.createBiquadFilter();
  airy.type = 'highpass';
  airy.frequency.value = room.echoFloorHz;
  delay.connect(airy).connect(feedback).connect(delay);
  const echoOut = context.createGain();
  echoOut.gain.value = room.echoLevel;
  delay.connect(echoOut).connect(bus);

  return { context, master, bus, echo: delay, noise: whiteNoise(context) };
}

/** Glides the whole score to `level` over about `seconds`. */
export function fadeTo(rig: Rig, level: number, seconds: number): void {
  const now = rig.context.currentTime;
  rig.master.gain.cancelScheduledValues(now);
  rig.master.gain.setTargetAtTime(level, now, seconds / 3);
}

export interface Envelope {
  readonly at: number;
  readonly attack: number;
  readonly level: number;
  readonly end: number;
}

/** A gain that rises from silence to `level` and falls back by `end`. */
export function envelope(context: AudioContext, { at, attack, level, end }: Envelope): GainNode {
  const gain = context.createGain();
  gain.gain.setValueAtTime(SILENT, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(level, SILENT * 2), at + attack);
  gain.gain.exponentialRampToValueAtTime(SILENT, end);
  return gain;
}

/** Starts the sources and unhooks everything once the last one ends. Left
 *  connected, finished notes pile up in the graph and the audio thread keeps
 *  working through them until the score crackles. */
export function playFor(
  sources: readonly AudioScheduledSourceNode[],
  nodes: readonly AudioNode[],
  { at, end }: { at: number; end: number },
): void {
  let playing = sources.length;
  sources.forEach((source) => {
    source.onended = () => {
      playing--;
      if (playing === 0) [...sources, ...nodes].forEach((node) => node.disconnect());
    };
    source.start(at);
    source.stop(end);
  });
}

/** A room made of decaying noise: a few seconds of it reads as space. */
function decayingNoise(context: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

function whiteNoise(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
