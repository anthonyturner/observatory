import { TestBed } from '@angular/core/testing';
import { ActiveVoice } from './active-voice';
import { ADAM, ELEVENLABS_ON, RACHEL, fakeCatalog } from './testing/voice-catalog-fixture';
import { CatalogState } from './voice-catalog.types';
import { VoiceChoice } from './voice-choice';

function setUp(state: CatalogState) {
  localStorage.clear();
  const catalog = fakeCatalog(state);
  TestBed.configureTestingModule({ providers: [catalog.provider] });
  const choice = TestBed.inject(VoiceChoice);
  return { active: TestBed.inject(ActiveVoice), choice, catalog: catalog.state };
}

describe('ActiveVoice', () => {
  it('speaks ElevenLabs from the start, in the account’s default voice', () => {
    const { active } = setUp(ELEVENLABS_ON);
    expect(active.speaker().engine).toBe('elevenlabs');
    expect(active.fallbackReason()).toBeNull();
  });

  it('is Kokoro for a browser that picked it', () => {
    const { active, choice } = setUp(ELEVENLABS_ON);
    choice.chooseEngine('kokoro');
    expect(active.speaker()).toEqual({ engine: 'kokoro' });
    expect(active.fallbackReason()).toBeNull();
  });

  it('speaks in the chosen ElevenLabs voice', () => {
    const { active, choice } = setUp(ELEVENLABS_ON);
    choice.chooseEngine('elevenlabs');
    choice.chooseVoice(ADAM.id);
    expect(active.speaker()).toEqual({ engine: 'elevenlabs', voice: ADAM });
  });

  it('falls back to the account’s default when the chosen voice is gone', () => {
    const { active, choice } = setUp(ELEVENLABS_ON);
    choice.chooseEngine('elevenlabs');
    choice.chooseVoice('deleted9');
    expect(active.elevenLabsVoice()).toEqual(RACHEL);
  });

  it('waits for the voices before naming one', () => {
    const { active, choice } = setUp({ status: 'reading' });
    choice.chooseEngine('elevenlabs');
    expect(active.speaker()).toEqual({ engine: 'elevenlabs', voice: null });
    expect(active.blocker()).toBeNull();
  });

  it.each<[CatalogState, string]>([
    [{ status: 'off' }, 'ElevenLabs is off: no key'],
    [{ status: 'unavailable' }, 'ElevenLabs isn’t available here'],
    [
      { status: 'on', voices: [], defaultVoice: null, failed: 'the key was refused' },
      'ElevenLabs couldn’t list its voices: the key was refused',
    ],
    [
      { status: 'on', voices: [], defaultVoice: null, failed: null },
      'ElevenLabs has no voices on this account',
    ],
  ])('gives Kokoro the replies, and says why, when ElevenLabs cannot speak', (state, reason) => {
    const { active, choice } = setUp(state);
    expect(active.blocker()).toBe(reason);
    choice.chooseEngine('elevenlabs');
    expect(active.speaker()).toEqual({ engine: 'kokoro' });
    expect(active.fallbackReason()).toBe(reason);
  });

  describe('the crew’s voice', () => {
    it('is the first the account lists that is not Jev’s', () => {
      const { active, choice } = setUp(ELEVENLABS_ON);
      choice.chooseVoice(RACHEL.id);
      expect(active.elevenLabsVoiceFor('jev')).toEqual(RACHEL);
      expect(active.elevenLabsVoiceFor('crew')).toEqual(ADAM);

      choice.chooseVoice(ADAM.id);
      expect(active.elevenLabsVoiceFor('jev')).toEqual(ADAM);
      expect(active.elevenLabsVoiceFor('crew')).toEqual(RACHEL);
    });

    it('is Jev’s own while his is the only voice on the account', () => {
      const { active } = setUp({
        status: 'on',
        voices: [RACHEL],
        defaultVoice: RACHEL.id,
        failed: null,
      });
      expect(active.elevenLabsVoiceFor('crew')).toEqual(RACHEL);
    });

    it.each<CatalogState>([{ status: 'reading' }, { status: 'off' }])(
      'is none until the account’s voices are read, or where ElevenLabs is off (%o)',
      (state) => {
        expect(setUp(state).active.elevenLabsVoiceFor('crew')).toBeNull();
      },
    );
  });

  it('keeps to Kokoro for the visit once ElevenLabs has failed', () => {
    const { active, choice } = setUp(ELEVENLABS_ON);
    choice.chooseEngine('elevenlabs');
    active.fallBack('ElevenLabs failed: the key was refused');
    expect(active.speaker()).toEqual({ engine: 'kokoro' });
    expect(active.fallbackReason()).toBe('ElevenLabs failed: the key was refused');
  });
});
