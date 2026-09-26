import { DevicePath } from './voice-protocol';

/** The graphics card with half precision, the card without it, or the processor. */
export type PathKey = 'gpu' | 'gpu32' | 'cpu';

/** Where a model runs, how big its download is, and what the page says of it. */
export interface ModelPath extends DevicePath {
  /** The download in MB, as measured in pr-starmap's spikes. */
  readonly mb: number;
  /** Where it runs, as in "Transcribing on …". */
  readonly on: string;
  /** The voice status line once it has loaded. */
  readonly ready: string;
}

export type ModelPaths = Readonly<Record<PathKey, ModelPath>>;

const GRAPHICS_CARD = 'the graphics card';

/** Where Whisper runs. fp16 needs the card's shader-f16 feature; q8 is quick
 *  on the processor but slow on the card. */
export const LISTEN_PATHS: ModelPaths = {
  gpu: {
    device: 'webgpu',
    dtype: 'fp16',
    mb: 150,
    on: GRAPHICS_CARD,
    ready: 'Speech model ready · graphics card',
  },
  gpu32: {
    device: 'webgpu',
    dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
    mb: 210,
    on: GRAPHICS_CARD,
    ready: 'Speech model ready · graphics card',
  },
  cpu: {
    device: 'wasm',
    dtype: 'q8',
    mb: 80,
    on: 'the processor, slower',
    ready:
      'No graphics-card path in this browser, so voice runs on the processor: slower, but it works.',
  },
};

/** Half-precision weights (fp16, q4f16) gave only NaN on the card, and q8
 *  there was ten times slower than fp32, so every card takes the full
 *  weights. The sizes add phonemizer (1.3 MB) and the voice (0.5 MB). */
const SPEAK_ON_CARD: ModelPath = {
  device: 'webgpu',
  dtype: 'fp32',
  mb: 330,
  on: GRAPHICS_CARD,
  ready: 'Voice model ready · graphics card',
};

/** Where Kokoro runs. */
export const SPEAK_PATHS: ModelPaths = {
  gpu: SPEAK_ON_CARD,
  gpu32: SPEAK_ON_CARD,
  cpu: {
    device: 'wasm',
    dtype: 'q8',
    mb: 95,
    on: 'the processor, slower',
    ready:
      'No graphics-card path in this browser, so replies are spoken from the processor: slower, but it works.',
  },
};
