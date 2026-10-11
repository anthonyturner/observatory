import { VoiceError } from '../voice-error';
import { RunRequest, SpokenClip, VoiceRole, WeightFormat } from '../voice-protocol';
import { kokoroVoiceClass } from './kokoro-module';
import { ModelEntry, PinnedModel, ReadyModel, formatOf, weightUrl } from './model-entry';
import { inLane } from './run-lane';
import { Disposable, KokoroVoice } from './transformers-api';

const KOKORO: PinnedModel = {
  id: 'onnx-community/Kokoro-82M-v1.0-ONNX',
  revision: '1939ad2a8e416c0acfeecc08a694d14ef25f2231',
};
/** Kokoro's own voices, at the pinned revision: a woman's American voice for
 *  Jev, and a man's British one for the crew, which no one mistakes for hers. */
const VOICES: Readonly<Record<VoiceRole, string>> = { jev: 'af_heart', crew: 'bm_george' };
const SUFFIX: Readonly<Partial<Record<WeightFormat, string>>> = { fp32: '', q8: '_quantized' };
const WARM_UP_TEXT = 'Ready.';

/** Kokoro-82M: text in, speech out. */
export const KOKORO_MODEL: ModelEntry = {
  ...KOKORO,
  files: (dtype) => [weightUrl(KOKORO, `model${SUFFIX[formatOf(dtype, 'model')] ?? ''}`)],
  // Built from its parts rather than through KokoroTTS.from_pretrained,
  // which drops the revision and so would fetch the weights from main.
  async load(lib, path, progress) {
    const KokoroTTS = await kokoroVoiceClass(KOKORO.revision);
    const options = { revision: KOKORO.revision, progress_callback: progress };
    const [model, tokenizer] = await Promise.all([
      lib.StyleTextToSpeech2Model.from_pretrained(KOKORO.id, { ...options, ...path }),
      lib.AutoTokenizer.from_pretrained(KOKORO.id, options),
    ]);
    const ready = new KokoroReady(new KokoroTTS(model, tokenizer), model);
    await warmUp(ready);
    return ready;
  },
};

export class KokoroReady implements ReadyModel {
  constructor(
    private readonly voice: KokoroVoice,
    private readonly model: Disposable,
  ) {}

  async run(request: RunRequest): Promise<SpokenClip> {
    if (request.model !== 'speak') throw new Error('Kokoro only speaks');
    const { audio, sampling_rate: rate } = await this.voice.generate(request.text, {
      voice: VOICES[request.role],
    });
    if (!audio.length || audio.some(Number.isNaN)) {
      throw new VoiceError('The voice model made no sound on this device.', 'silent');
    }
    return { audio, rate };
  }

  async dispose(): Promise<void> {
    await this.model.dispose();
  }
}

/** One word at load time fetches the voice and, on the graphics card,
 *  compiles the shaders, which would add about three seconds to the first
 *  reply. Half-precision weights gave only NaN on the card in the spike; a
 *  card that does the same with these fails here and falls back. */
async function warmUp(ready: KokoroReady): Promise<void> {
  try {
    await inLane(() => ready.run({ model: 'speak', text: WARM_UP_TEXT, role: 'jev' }));
  } catch (error: unknown) {
    await ready.dispose();
    throw error;
  }
}
