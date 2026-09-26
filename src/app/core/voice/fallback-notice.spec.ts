import { TestBed } from '@angular/core/testing';
import { ActiveVoice } from './active-voice';
import { FallbackNotice } from './fallback-notice';
import { SpeakPreference } from './speak-preference';
import { ELEVENLABS_ON, fakeCatalog } from './testing/voice-catalog-fixture';
import { CatalogState } from './voice-catalog.types';
import { VoiceChoice } from './voice-choice';
import { VoiceStatus } from './voice-status';

function setUp(state: CatalogState, isSpeakOn = true) {
  localStorage.clear();
  if (isSpeakOn) localStorage.setItem('observatory.speak', 'on');
  TestBed.configureTestingModule({ providers: [fakeCatalog(state).provider] });
  TestBed.inject(VoiceChoice).chooseEngine('elevenlabs');
  TestBed.inject(FallbackNotice);
  TestBed.tick();
  return {
    status: TestBed.inject(VoiceStatus),
    active: TestBed.inject(ActiveVoice),
    preference: TestBed.inject(SpeakPreference),
  };
}

describe('FallbackNotice', () => {
  it('says why Kokoro speaks when ElevenLabs is chosen but off', () => {
    const { status } = setUp({ status: 'off' });
    expect(status.line()?.words).toBe('ElevenLabs is off: no key, so Kokoro speaks.');
  });

  it('waits for Speak to be on before saying it', () => {
    const { status, preference } = setUp({ status: 'unavailable' }, false);
    expect(status.line()).toBeNull();

    preference.turnOn();
    TestBed.tick();

    expect(status.line()?.words).toBe('ElevenLabs isn’t available here, so Kokoro speaks.');
  });

  it('says nothing while ElevenLabs can speak', () => {
    const { status } = setUp(ELEVENLABS_ON);
    expect(status.line()).toBeNull();
  });

  it('says it once a visit', () => {
    const { status, preference } = setUp({ status: 'off' });
    status.clear();

    preference.turnOff();
    TestBed.tick();
    preference.turnOn();
    TestBed.tick();

    expect(status.line()).toBeNull();
  });

  it('says so when ElevenLabs fails mid-visit', () => {
    const { status, active } = setUp(ELEVENLABS_ON);

    active.fallBack('ElevenLabs failed: the key was refused');
    TestBed.tick();

    expect(status.line()?.words).toBe('ElevenLabs failed: the key was refused, so Kokoro speaks.');
  });
});
