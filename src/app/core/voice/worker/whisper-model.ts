import { RunRequest, Transcript, WeightFormat } from '../voice-protocol';
import { ModelEntry, PinnedModel, ReadyModel, formatOf, weightUrl } from './model-entry';
import { inLane } from './run-lane';
import {
  SpeechRecognizer,
  WhisperTokenizer,
  isDisposable,
  isSpeechRecognizer,
} from './transformers-api';

/** English only: on a clip of a few words the multilingual model's guess at
 *  the language was often wrong, and the router reads English. Its files are
 *  the same sizes as the multilingual base's. */
const WHISPER: PinnedModel = {
  id: 'onnx-community/whisper-base.en',
  revision: '51eefc0af78b103839eda9e7e4f4186acc6517fe',
};
const PARTS = ['encoder_model', 'decoder_model_merged'] as const;
const SUFFIX: Readonly<Record<WeightFormat, string>> = {
  fp32: '',
  fp16: '_fp16',
  q8: '_quantized',
  q4: '_q4',
};
const TOKEN = {
  previous: '<|startofprev|>',
  transcript: '<|startoftranscript|>',
  noTimestamps: '<|notimestamps|>',
} as const;
/** Whisper reads at most half its 448-token context as a prompt, less the
 *  token that opens it, and leaves the rest for what it hears. */
export const MAX_PROMPT_TOKENS = 223;
/** One second of silence at 16 kHz. */
const WARM_UP_SAMPLES = 16000;

/** Whisper base.en: speech in, English text out. */
export const WHISPER_MODEL: ModelEntry = {
  ...WHISPER,
  files: (dtype) =>
    PARTS.map((part) => weightUrl(WHISPER, `${part}${SUFFIX[formatOf(dtype, part)]}`)),
  async load(lib, path, progress) {
    const made = await lib.pipeline('automatic-speech-recognition', WHISPER.id, {
      ...path,
      revision: WHISPER.revision,
      progress_callback: progress,
    });
    const ready = new WhisperReady(await recognizerOf(made));
    // The graphics card compiles its shaders on the first run, which would
    // otherwise add about two seconds to the first thing said.
    if (path.device === 'webgpu') await warmUp(ready);
    return ready;
  },
};

async function recognizerOf(made: unknown): Promise<SpeechRecognizer> {
  if (isSpeechRecognizer(made)) return made;
  if (isDisposable(made)) await made.dispose();
  throw new Error('transformers.js gave Whisper without the parts the worker runs');
}

function tokenIdOf(tokenizer: WhisperTokenizer, token: string): number {
  const id = tokenizer.convert_tokens_to_ids(token);
  if (typeof id !== 'number') throw new Error(`Whisper's tokenizer has no ${token}`);
  return id;
}

/**
 * The tokens Whisper's decoder starts from. A prompt goes first, as text it
 * had just heard, so it expects those words; Whisper's tokenizer does the
 * same in Python (`get_prompt_ids`). A long prompt keeps its first tokens,
 * which are the words most needed.
 */
export function decoderStartOf(tokenizer: WhisperTokenizer, prompt: string): number[] {
  const start = [TOKEN.transcript, TOKEN.noTimestamps].map((token) => tokenIdOf(tokenizer, token));
  const text = prompt.trim();
  if (!text) return start;
  const words = tokenizer.encode(` ${text}`, { add_special_tokens: false });
  return [tokenIdOf(tokenizer, TOKEN.previous), ...words.slice(0, MAX_PROMPT_TOKENS), ...start];
}

class WhisperReady implements ReadyModel {
  constructor(private readonly recognizer: SpeechRecognizer) {}

  async run(request: RunRequest): Promise<Transcript> {
    if (request.model !== 'listen') throw new Error('Whisper only listens');
    const { tokenizer, model } = this.recognizer;
    const start = decoderStartOf(tokenizer, request.prompt);
    const { input_features } = await this.recognizer.processor(request.audio);
    const [sequence] = (
      await model.generate({ inputs: input_features, decoder_input_ids: start })
    ).tolist();
    const heard = sequence?.slice(start.length) ?? [];
    return {
      text: heard.length ? tokenizer.decode(heard, { skip_special_tokens: true }).trim() : '',
    };
  }

  async dispose(): Promise<void> {
    await this.recognizer.dispose();
  }
}

async function warmUp(ready: WhisperReady): Promise<void> {
  try {
    await inLane(() =>
      ready.run({ model: 'listen', audio: new Float32Array(WARM_UP_SAMPLES), prompt: '' }),
    );
  } catch (error: unknown) {
    await ready.dispose();
    throw error;
  }
}
