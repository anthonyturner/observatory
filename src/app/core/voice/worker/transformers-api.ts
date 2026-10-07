import { DevicePath } from '../voice-protocol';

/** The parts of transformers.js the worker uses. It is loaded at run time
 *  from jsDelivr, so nothing typed it; `isTransformers` checks the shape. */
export interface Transformers {
  readonly env: TransformersEnv;
  /** Checked with `isSpeechRecognizer`. */
  pipeline(
    task: 'automatic-speech-recognition',
    model: string,
    options: PretrainedOptions & DevicePath,
  ): Promise<unknown>;
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

/** The parts of Whisper's tokenizer the worker uses. */
export interface WhisperTokenizer {
  encode(text: string, options: { readonly add_special_tokens: boolean }): number[];
  decode(
    ids: readonly (number | bigint)[],
    options: { readonly skip_special_tokens: boolean },
  ): string;
  convert_tokens_to_ids(token: string): unknown;
}

export interface WhisperGenerateOptions {
  /** The audio's log-mel features, as the processor made them. */
  readonly inputs: unknown;
  /** The tokens the decoder starts from: any prompt, then the transcript's start. */
  readonly decoder_input_ids: readonly number[];
}

/** Each sequence generated, the start it was given included. */
export interface TokenSequences {
  tolist(): (number | bigint)[][];
}

/** transformers.js's speech-recognition pipeline, taken apart: it would
 *  return a prompt's words as part of the transcript. */
export interface SpeechRecognizer extends Disposable {
  readonly tokenizer: WhisperTokenizer;
  readonly model: { generate(options: WhisperGenerateOptions): Promise<TokenSequences> };
  processor(audio: Float32Array): Promise<{ readonly input_features: unknown }>;
}

/** transformers.js's pipelines and processors are callable objects: functions. */
const isObjectLike = (value: unknown): value is object =>
  (typeof value === 'object' && value !== null) || typeof value === 'function';

const hasFunction = (value: unknown, name: string): boolean =>
  isObjectLike(value) && typeof Reflect.get(value, name) === 'function';

export const isDisposable = (made: unknown): made is Disposable => hasFunction(made, 'dispose');

export function isSpeechRecognizer(made: unknown): made is SpeechRecognizer {
  if (!isObjectLike(made)) return false;
  const tokenizer: unknown = Reflect.get(made, 'tokenizer');
  return (
    isDisposable(made) &&
    hasFunction(made, 'processor') &&
    hasFunction(Reflect.get(made, 'model'), 'generate') &&
    ['encode', 'decode', 'convert_tokens_to_ids'].every((name) => hasFunction(tokenizer, name))
  );
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
