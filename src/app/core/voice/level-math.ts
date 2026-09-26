/** How a loudness reading is scaled and smoothed. */
export interface LevelShape {
  /** Multiplies the root-mean-square, so a voice nears 1. */
  readonly gain: number;
  /** How much of the previous level each new one keeps, 0 to 1. */
  readonly keep: number;
}

/** The mic's level: a speaking voice reads near full. */
export const MIC_LEVEL: LevelShape = { gain: 7, keep: 0.6 };
/** A reply's level: quicker to follow than the mic's. */
export const SPEECH_LEVEL: LevelShape = { gain: 6, keep: 0.55 };

/** The next smoothed level, 0 to 1, from one frame of samples. */
export function nextLevel(previous: number, samples: Float32Array, shape: LevelShape): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  const now = Math.min(1, Math.sqrt(sum / Math.max(1, samples.length)) * shape.gain);
  return previous * shape.keep + (Number.isFinite(now) ? now : 0) * (1 - shape.keep);
}
