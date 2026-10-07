import { VoiceFailureKind } from './voice-error';

/** The models the voice worker runs: Whisper hears, Kokoro speaks. */
export type VoiceModelId = 'listen' | 'speak';

export type WeightFormat = 'fp32' | 'fp16' | 'q8' | 'q4';
/** One number format for every weight file, or one per file. */
export type WeightChoice = WeightFormat | Readonly<Record<string, WeightFormat>>;
export type VoiceDevice = 'webgpu' | 'wasm';

/** Where a model runs, and in what number format. */
export interface DevicePath {
  readonly device: VoiceDevice;
  readonly dtype: WeightChoice;
}

export type RunRequest =
  /** `prompt` primes Whisper with words to expect; empty for none. */
  | { readonly model: 'listen'; readonly audio: Float32Array; readonly prompt: string }
  | { readonly model: 'speak'; readonly text: string };

export type VoiceRequest =
  | ({ readonly op: 'load'; readonly model: VoiceModelId } & DevicePath)
  | { readonly op: 'unload'; readonly model: VoiceModelId }
  | { readonly op: 'cached'; readonly model: VoiceModelId; readonly dtype: WeightChoice }
  | ({ readonly op: 'run' } & RunRequest);

/** A request on its way to the worker, numbered so its answer finds it. */
export interface VoiceCall {
  readonly id: number;
  readonly request: VoiceRequest;
}

export interface Transcript {
  readonly text: string;
}

/** A sentence as sound: mono samples at `rate` per second. */
export interface SpokenClip {
  readonly audio: Float32Array<ArrayBuffer>;
  readonly rate: number;
}

export interface CacheAnswer {
  readonly cached: boolean;
}

export type VoiceResult = Record<string, never> | CacheAnswer | Transcript | SpokenClip;

export type VoiceReply =
  | {
      readonly op: 'progress';
      readonly id: number;
      readonly loaded: number;
      readonly total: number;
    }
  | { readonly op: 'done'; readonly id: number; readonly result: VoiceResult }
  | {
      readonly op: 'failed';
      readonly id: number;
      readonly kind: VoiceFailureKind;
      readonly message: string;
    }
  /** The graphics card dropped its device, and the model on it with it. */
  | { readonly op: 'lost'; readonly model: VoiceModelId };
