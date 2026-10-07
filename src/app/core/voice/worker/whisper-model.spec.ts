import { DevicePath } from '../voice-protocol';
import { Transformers, WhisperGenerateOptions, WhisperTokenizer } from './transformers-api';
import { MAX_PROMPT_TOKENS, WHISPER_MODEL, decoderStartOf } from './whisper-model';

const SPECIAL: Readonly<Record<string, number>> = {
  '<|startofprev|>': 50360,
  '<|startoftranscript|>': 50257,
  '<|notimestamps|>': 50362,
};
const END_OF_TEXT = 50256;
const PROCESSOR_PATH: DevicePath = { device: 'wasm', dtype: 'q8' };

/** One token per character, numbered from its code; special tokens as Whisper's. */
const fakeTokenizer: WhisperTokenizer = {
  encode: (text) => [...text].map((char) => char.charCodeAt(0)),
  decode: (ids, { skip_special_tokens }) =>
    ids
      .map(Number)
      .filter((id) => !skip_special_tokens || id < END_OF_TEXT)
      .map((id) => String.fromCharCode(id))
      .join(''),
  convert_tokens_to_ids: (token) => SPECIAL[token],
};

/** A pipeline that "hears" ` dismiss PR 412` after whatever start it is given. */
function fakeRecognizer(generated: WhisperGenerateOptions[]) {
  const heard = fakeTokenizer.encode(' dismiss PR 412', { add_special_tokens: false });
  const recognizer = Object.assign(async () => ({ text: '' }), {
    tokenizer: fakeTokenizer,
    processor: async (audio: Float32Array) => ({ input_features: audio }),
    model: {
      generate: async (options: WhisperGenerateOptions) => {
        generated.push(options);
        return { tolist: () => [[...options.decoder_input_ids, ...heard, END_OF_TEXT]] };
      },
    },
    dispose: vi.fn(),
  });
  return recognizer;
}

function fakeLibrary(made: unknown): Transformers {
  return {
    env: { allowLocalModels: false, fetch },
    pipeline: async () => made,
    StyleTextToSpeech2Model: { from_pretrained: async () => ({ dispose: () => undefined }) },
    AutoTokenizer: { from_pretrained: async () => ({}) },
  };
}

describe('decoderStartOf', () => {
  const start = [SPECIAL['<|startoftranscript|>'], SPECIAL['<|notimestamps|>']];

  it('starts the transcript straight away with no prompt', () => {
    expect(decoderStartOf(fakeTokenizer, '  ')).toEqual(start);
  });

  it('puts the prompt first, after the token that opens it', () => {
    expect(decoderStartOf(fakeTokenizer, 'Jev')).toEqual([
      SPECIAL['<|startofprev|>'],
      ...fakeTokenizer.encode(' Jev', { add_special_tokens: false }),
      ...start,
    ]);
  });

  it('keeps the first tokens of a prompt too long for Whisper', () => {
    const ids = decoderStartOf(fakeTokenizer, 'x'.repeat(MAX_PROMPT_TOKENS * 2));
    expect(ids).toHaveLength(1 + MAX_PROMPT_TOKENS + start.length);
    expect(ids.slice(1, 3)).toEqual(fakeTokenizer.encode(' x', { add_special_tokens: false }));
  });
});

describe('WHISPER_MODEL', () => {
  it('is the English-only base model', () => {
    expect(WHISPER_MODEL.id).toBe('onnx-community/whisper-base.en');
  });

  it('hears with the prompt given, and leaves the prompt out of the words', async () => {
    const generated: WhisperGenerateOptions[] = [];
    const ready = await WHISPER_MODEL.load(
      fakeLibrary(fakeRecognizer(generated)),
      PROCESSOR_PATH,
      () => undefined,
    );

    const heard = await ready.run({
      model: 'listen',
      audio: new Float32Array(4),
      prompt: 'Jev, PR 412.',
    });

    expect(heard).toEqual({ text: 'dismiss PR 412' });
    expect(generated[0].decoder_input_ids).toEqual(decoderStartOf(fakeTokenizer, 'Jev, PR 412.'));
  });

  it('refuses a pipeline without the parts it runs, freeing it', async () => {
    const dispose = vi.fn();
    const load = WHISPER_MODEL.load(fakeLibrary({ dispose }), PROCESSOR_PATH, () => undefined);
    await expect(load).rejects.toThrow('without the parts');
    expect(dispose).toHaveBeenCalled();
  });
});
