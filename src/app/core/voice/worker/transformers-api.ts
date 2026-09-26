import { DevicePath } from '../voice-protocol';

/** The parts of transformers.js the worker uses. It is loaded at run time
 *  from jsDelivr, so nothing typed it; `isTransformers` checks the shape. */
export interface Transformers {
  readonly env: TransformersEnv;
  pipeline(
    task: 'automatic-speech-recognition',
    model: string,
    options: PretrainedOptions & DevicePath,
  ): Promise<SpeechRecognizer>;
  readonly StyleTextToSpeech2Model: {
    from_pretrained(model: string, options: PretrainedOptions & DevicePath): Promise<Disposable>;
  };
  readonly AutoTokenizer: {
    from_pretrained(model: string, options: PretrainedOptions): Promise<unknown>;
  };
}

export interface TransformersEnv {
  allowLocalModels: boolean;
  fetch: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  readonly backends?: { readonly onnx?: { readonly webgpu?: { readonly device?: unknown } } };
}

export interface LoadProgress {
  readonly status: string;
  readonly file?: string;
  readonly loaded?: number;
  readonly total?: number;
}

export type ProgressCallback = (progress: LoadProgress) => void;

export interface PretrainedOptions {
  readonly revision: string;
  readonly progress_callback: ProgressCallback;
}

export interface Disposable {
  dispose(): Promise<void> | void;
}

export interface SpeechRecognizer extends Disposable {
  (
    audio: Float32Array,
    options: { readonly language: string; readonly task: 'transcribe' },
  ): Promise<{ readonly text?: unknown }>;
}

/** kokoro-js's voice, built from the model and tokenizer above. */
export interface KokoroVoice {
  generate(
    text: string,
    options: { readonly voice: string },
  ): Promise<{ readonly audio: Float32Array<ArrayBuffer>; readonly sampling_rate: number }>;
}

export type KokoroConstructor = new (model: Disposable, tokenizer: unknown) => KokoroVoice;

export function isTransformers(module: unknown): module is Transformers {
  if (typeof module !== 'object' || module === null) return false;
  const lib = module as Partial<Record<keyof Transformers, unknown>>;
  return (
    typeof lib.env === 'object' &&
    typeof lib.pipeline === 'function' &&
    typeof lib.StyleTextToSpeech2Model === 'function' &&
    typeof lib.AutoTokenizer === 'function'
  );
}

export function kokoroConstructorOf(module: unknown): KokoroConstructor | null {
  if (typeof module !== 'object' || module === null || !('KokoroTTS' in module)) return null;
  const made = module.KokoroTTS;
  return typeof made === 'function' ? (made as KokoroConstructor) : null;
}
