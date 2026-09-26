import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { REPLY_VOICE } from './reply-voice';
import { SpeakPreference } from './speak-preference';
import { SpeakerOutput } from './speaker-output';
import { SPEECH_ENGINE } from './speech-engine';
import { FakeSpeechEngine } from './testing/fake-speech-engine';
import { VoiceChoice } from './voice-choice';
import { VoicePick } from './voice-pick';

function setUp(isSpeakOn: boolean) {
  localStorage.clear();
  if (isSpeakOn) localStorage.setItem('observatory.speak', 'on');
  const engine = new FakeSpeechEngine();
  const stop = vi.fn(() => true);
  const wake = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: SPEECH_ENGINE, useValue: engine },
      {
        provide: REPLY_VOICE,
        useValue: { speak: async () => undefined, stop, speaking: signal(false) },
      },
      { provide: SpeakerOutput, useValue: { wake } },
    ],
  });
  return {
    pick: TestBed.inject(VoicePick),
    choice: TestBed.inject(VoiceChoice),
    preference: TestBed.inject(SpeakPreference),
    engine,
    stop,
    wake,
  };
}

describe('VoicePick', () => {
  it('cuts off the reply and lets the old engine go before switching', async () => {
    const { pick, choice, engine, stop } = setUp(false);

    await pick.chooseEngine('elevenlabs');

    expect(stop).toHaveBeenCalledTimes(1);
    expect(engine.released).toBe(1);
    expect(choice.engine()).toBe('elevenlabs');
    expect(engine.warmUps).toBe(0);
  });

  it('gets the new engine ready inside the pick when Speak is on', async () => {
    const { pick, engine, wake } = setUp(true);

    await pick.chooseEngine('elevenlabs');

    expect(wake).toHaveBeenCalled();
    expect(engine.warmUps).toBe(1);
  });

  it('leaves Speak off until a download it asked about is agreed', async () => {
    const { pick, engine, preference } = setUp(true);
    engine.warmUpAnswer = 'asked';

    await pick.chooseEngine('elevenlabs');

    expect(preference.isOn()).toBe(false);
  });

  it('does nothing when the engine is already the chosen one', async () => {
    const { pick, engine, stop } = setUp(true);

    await pick.chooseEngine('kokoro');

    expect(stop).not.toHaveBeenCalled();
    expect(engine.released).toBe(0);
  });

  it('keeps a new voice without cutting off the reply', () => {
    const { pick, choice, stop } = setUp(true);

    pick.chooseVoice('adam02');

    expect(choice.voice()).toBe('adam02');
    expect(stop).not.toHaveBeenCalled();
  });
});
