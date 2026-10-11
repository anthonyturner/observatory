import { VoiceError } from '../voice-error';
import { KokoroReady } from './kokoro-model';
import { KokoroVoice } from './transformers-api';

function setUp(audio: Float32Array<ArrayBuffer> = new Float32Array([0.1, 0.2])) {
  const generate = vi.fn<KokoroVoice['generate']>(async () => ({ audio, sampling_rate: 24_000 }));
  return { ready: new KokoroReady({ generate }, { dispose: vi.fn() }), generate };
}

describe('KokoroReady', () => {
  it('speaks Jev in a woman’s American voice and the crew in a man’s British one', async () => {
    const { ready, generate } = setUp();

    await ready.run({ model: 'speak', text: 'Merged!', role: 'jev' });
    await ready.run({ model: 'speak', text: 'Goodbye!', role: 'crew' });

    expect(generate.mock.calls).toEqual([
      ['Merged!', { voice: 'af_heart' }],
      ['Goodbye!', { voice: 'bm_george' }],
    ]);
  });

  it('gives back the sound it made', async () => {
    const { ready } = setUp();

    expect(await ready.run({ model: 'speak', text: 'Hi.', role: 'crew' })).toEqual({
      audio: new Float32Array([0.1, 0.2]),
      rate: 24_000,
    });
  });

  it('fails as silent when a voice makes no sound or only NaN', async () => {
    for (const audio of [new Float32Array(0), new Float32Array([Number.NaN])]) {
      const { ready } = setUp(audio);
      await expect(ready.run({ model: 'speak', text: 'Hi.', role: 'crew' })).rejects.toEqual(
        new VoiceError('The voice model made no sound on this device.', 'silent'),
      );
    }
  });
});
