import { RunRequest, Transcript, WeightFormat } from '../voice-protocol';
import { ModelEntry, PinnedModel, ReadyModel, formatOf, weightUrl } from './model-entry';
import { inLane } from './run-lane';
import { SpeechRecognizer } from './transformers-api';

const WHISPER: PinnedModel = {
  id: 'onnx-community/whisper-base',
  revision: '1846881b6b3a3024392c1eea3ad983695bc23925',
};
const PARTS = ['encoder_model', 'decoder_model_merged'] as const;
const SUFFIX: Readonly<Record<WeightFormat, string>> = {
  fp32: '',
  fp16: '_fp16',
  q8: '_quantized',
  q4: '_q4',
};
/** English is fixed: on a clip of a few words Whisper's own guess at the
 *  language is often wrong, and the router reads English. */
const TRANSCRIBE = { language: 'english', task: 'transcribe' } as const;
/** One second of silence at 16 kHz. */
const WARM_UP_SAMPLES = 16000;

/** Whisper base: speech in, English text out. */
export const WHISPER_MODEL: ModelEntry = {
  ...WHISPER,
  files: (dtype) =>
    PARTS.map((part) => weightUrl(WHISPER, `${part}${SUFFIX[formatOf(dtype, part)]}`)),
  async load(lib, path, progress) {
    const recognizer = await lib.pipeline('automatic-speech-recognition', WHISPER.id, {
      ...path,
      revision: WHISPER.revision,
      progress_callback: progress,
    });
    const ready = new WhisperReady(recognizer);
    // The graphics card compiles its shaders on the first run, which would
    // otherwise add about two seconds to the first thing said.
    if (path.device === 'webgpu') await warmUp(ready);
    return ready;
  },
};

class WhisperReady implements ReadyModel {
  constructor(private readonly recognizer: SpeechRecognizer) {}

  async run(request: RunRequest): Promise<Transcript> {
    if (request.model !== 'listen') throw new Error('Whisper only listens');
    const heard = await this.recognizer(request.audio, TRANSCRIBE);
    return { text: String(heard.text ?? '').trim() };
  }

  async dispose(): Promise<void> {
    await this.recognizer.dispose();
  }
}

async function warmUp(ready: WhisperReady): Promise<void> {
  try {
    await inLane(() => ready.run({ model: 'listen', audio: new Float32Array(WARM_UP_SAMPLES) }));
  } catch (error: unknown) {
    await ready.dispose();
    throw error;
  }
}
