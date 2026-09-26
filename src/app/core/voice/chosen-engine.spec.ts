import { TestBed } from '@angular/core/testing';
import { ActiveVoice } from './active-voice';
import { ChosenEngine, SPEECH_ENGINES } from './chosen-engine';
import { SpeakPreference } from './speak-preference';
import { FakeSpeechEngine } from './testing/fake-speech-engine';
import { ELEVENLABS_ON, fakeCatalog } from './testing/voice-catalog-fixture';
import { CatalogState } from './voice-catalog.types';
import { VoiceChoice, VoiceEngineId } from './voice-choice';
import { VoiceError } from './voice-error';

const REQUEST = { takesFocus: false, onAgreed: () => undefined };

function setUp(chosen: VoiceEngineId, state: CatalogState = ELEVENLABS_ON) {
  localStorage.clear();
  localStorage.setItem('observatory.speak', 'on');
  const kokoro = new FakeSpeechEngine();
  const elevenlabs = new FakeSpeechEngine();
  TestBed.configureTestingModule({
    providers: [
      fakeCatalog(state).provider,
      { provide: SPEECH_ENGINES, useValue: { kokoro, elevenlabs } },
    ],
  });
  TestBed.inject(VoiceChoice).chooseEngine(chosen);
  return {
    engine: TestBed.inject(ChosenEngine),
    kokoro,
    elevenlabs,
    active: TestBed.inject(ActiveVoice),
    preference: TestBed.inject(SpeakPreference),
  };
}

describe('ChosenEngine', () => {
  it('hands everything to Kokoro when Kokoro is chosen', async () => {
    const { engine, kokoro, elevenlabs } = setUp('kokoro');

    await engine.warmUp(REQUEST);
    await engine.synthesize('Hello.');
    engine.release();

    expect(kokoro.warmUps).toBe(1);
    expect(kokoro.said).toEqual(['Hello.']);
    expect(kokoro.released).toBe(1);
    expect(elevenlabs.warmUps).toBe(0);
  });

  it('hands everything to ElevenLabs when it is chosen and on', async () => {
    const { engine, kokoro, elevenlabs } = setUp('elevenlabs');

    expect(await engine.warmUp(REQUEST)).toBe('ready');
    await engine.synthesize('Hello.');
    engine.release();

    expect(elevenlabs.said).toEqual(['Hello.']);
    expect(elevenlabs.released).toBe(1);
    expect(kokoro.warmUps).toBe(0);
  });

  it('lets Kokoro speak when ElevenLabs is off', async () => {
    const { engine, kokoro, elevenlabs } = setUp('elevenlabs', { status: 'off' });

    await engine.warmUp(REQUEST);
    await engine.synthesize('Hello.');

    expect(kokoro.said).toEqual(['Hello.']);
    expect(elevenlabs.warmUps).toBe(0);
  });

  it('passes a Kokoro download question on when ElevenLabs is not available', async () => {
    const { engine, kokoro } = setUp('elevenlabs', { status: 'unavailable' });
    kokoro.warmUpAnswer = 'asked';

    expect(await engine.warmUp(REQUEST)).toBe('asked');
  });

  it('turns to Kokoro for the visit when ElevenLabs fails mid-reply', async () => {
    const { engine, kokoro, elevenlabs, active } = setUp('elevenlabs');
    await engine.warmUp(REQUEST);
    elevenlabs.failure = new VoiceError('the key was refused', 'run');

    await engine.synthesize('First.');
    await engine.synthesize('Second.');

    expect(kokoro.said).toEqual(['First.', 'Second.']);
    expect(elevenlabs.released).toBe(1);
    expect(active.fallbackReason()).toBe('ElevenLabs failed: the key was refused');
  });

  it('turns Speak off quietly when Kokoro must first ask to download', async () => {
    const { engine, kokoro, elevenlabs, preference } = setUp('elevenlabs');
    const failure = new VoiceError('the site didn’t answer', 'run');
    elevenlabs.failure = failure;
    kokoro.warmUpAnswer = 'asked';

    await expect(engine.synthesize('Hello.')).rejects.toBe(failure);
    expect(preference.isOn()).toBe(false);
    expect(kokoro.said).toEqual([]);
  });

  it('lets a Kokoro failure through as it is', async () => {
    const { engine, kokoro } = setUp('kokoro');
    const failure = new VoiceError('no model', 'model');
    kokoro.failure = failure;

    await expect(engine.synthesize('Hello.')).rejects.toBe(failure);
  });
});
