import { TestBed } from '@angular/core/testing';
import { VoiceChoice } from './voice-choice';

const KEY = 'observatory.voice';

describe('VoiceChoice', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('starts with Kokoro and no ElevenLabs voice', () => {
    const choice = TestBed.inject(VoiceChoice);
    expect(choice.engine()).toBe('kokoro');
    expect(choice.voice()).toBeNull();
  });

  it('remembers the engine and the voice in this browser', () => {
    const choice = TestBed.inject(VoiceChoice);
    choice.chooseEngine('elevenlabs');
    choice.chooseVoice('adam02');

    expect(choice.engine()).toBe('elevenlabs');
    expect(choice.voice()).toBe('adam02');
    expect(JSON.parse(localStorage.getItem(KEY) ?? '')).toEqual({
      engine: 'elevenlabs',
      voice: 'adam02',
    });
  });

  it('starts as it was left', () => {
    localStorage.setItem(KEY, JSON.stringify({ engine: 'elevenlabs', voice: 'rachel01' }));
    const choice = TestBed.inject(VoiceChoice);
    expect(choice.engine()).toBe('elevenlabs');
    expect(choice.voice()).toBe('rachel01');
  });

  it('starts with Kokoro when what was kept is not a choice', () => {
    localStorage.setItem(KEY, '{not json');
    expect(TestBed.inject(VoiceChoice).engine()).toBe('kokoro');
  });

  it('drops an engine it does not know', () => {
    localStorage.setItem(KEY, JSON.stringify({ engine: 'robot', voice: 'rachel01' }));
    const choice = TestBed.inject(VoiceChoice);
    expect(choice.engine()).toBe('kokoro');
    expect(choice.voice()).toBe('rachel01');
  });

  it('still works where storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const choice = TestBed.inject(VoiceChoice);
    expect(choice.engine()).toBe('kokoro');
    choice.chooseEngine('elevenlabs');
    expect(choice.engine()).toBe('elevenlabs');
  });
});
