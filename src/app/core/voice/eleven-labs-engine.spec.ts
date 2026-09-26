import { TestBed } from '@angular/core/testing';
import { AUDIO_DECODER, AudioDecoder } from './audio-decoder';
import { ElevenLabsEngine } from './eleven-labs-engine';
import { ELEVENLABS_SPEECH, ElevenLabsRefusal, ElevenLabsSpeech } from './eleven-labs-speech';
import { ADAM, ELEVENLABS_ON, fakeCatalog } from './testing/voice-catalog-fixture';
import { CatalogState } from './voice-catalog.types';
import { VoiceChoice } from './voice-choice';
import { VoiceError } from './voice-error';
import { SpokenClip } from './voice-protocol';

const MP3 = new ArrayBuffer(4);
const CLIP: SpokenClip = { audio: new Float32Array(3), rate: 44_100 };

function setUp(state: CatalogState = ELEVENLABS_ON) {
  localStorage.clear();
  const speech = { speak: vi.fn<ElevenLabsSpeech['speak']>(async () => MP3) };
  const decoder = { decode: vi.fn<AudioDecoder['decode']>(async () => CLIP) };
  TestBed.configureTestingModule({
    providers: [
      fakeCatalog(state).provider,
      { provide: ELEVENLABS_SPEECH, useValue: speech },
      { provide: AUDIO_DECODER, useValue: decoder },
    ],
  });
  const choice = TestBed.inject(VoiceChoice);
  choice.chooseEngine('elevenlabs');
  return { engine: TestBed.inject(ElevenLabsEngine), speech, decoder, choice };
}

describe('ElevenLabsEngine', () => {
  it('is ready at once: there is nothing to download', async () => {
    const { engine } = setUp();
    expect(await engine.warmUp()).toBe('ready');
  });

  it('speaks a sentence in the chosen voice and decodes what comes back', async () => {
    const { engine, speech, decoder, choice } = setUp();
    choice.chooseVoice(ADAM.id);

    expect(await engine.synthesize('Voice check.')).toBe(CLIP);
    expect(speech.speak).toHaveBeenCalledWith({ text: 'Voice check.', voice: ADAM.id });
    expect(decoder.decode).toHaveBeenCalledWith(MP3);
  });

  it('fails in the site’s words when the site refuses', async () => {
    const { engine, speech } = setUp();
    speech.speak.mockRejectedValue(new ElevenLabsRefusal('the key was refused'));

    await expect(engine.synthesize('Hello.')).rejects.toEqual(
      new VoiceError('the key was refused', 'run'),
    );
  });

  it('fails when the sound cannot be decoded', async () => {
    const { engine, decoder } = setUp();
    decoder.decode.mockRejectedValue(new DOMException('bad', 'EncodingError'));

    await expect(engine.synthesize('Hello.')).rejects.toEqual(
      new VoiceError('it sent sound this browser couldn’t play', 'run'),
    );
  });

  it('fails without a call when the account has no voice', async () => {
    const { engine, speech } = setUp({ status: 'off' });

    await expect(engine.synthesize('Hello.')).rejects.toBeInstanceOf(VoiceError);
    expect(speech.speak).not.toHaveBeenCalled();
  });
});
