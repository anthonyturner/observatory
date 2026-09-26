import { WHISPER_RATE, isQuiet, isWordless } from './clip-audio';

function clip(seconds: number, peak: number): Float32Array {
  const audio = new Float32Array(Math.round(WHISPER_RATE * seconds));
  audio[Math.floor(audio.length / 2)] = peak;
  return audio;
}

describe('isQuiet', () => {
  it('hears a voice: long enough and loud enough', () => {
    expect(isQuiet(clip(1, 0.3))).toBe(false);
    expect(isQuiet(clip(1, -0.3))).toBe(false);
  });

  it('takes a clip too short to hold a word as quiet', () => {
    expect(isQuiet(clip(0.2, 0.9))).toBe(true);
  });

  it('takes a room with no voice as quiet', () => {
    expect(isQuiet(clip(2, 0.01))).toBe(true);
  });
});

describe('isWordless', () => {
  it('takes nothing, or what Whisper names in brackets, as no words', () => {
    expect(isWordless('')).toBe(true);
    expect(isWordless('[BLANK_AUDIO]')).toBe(true);
    expect(isWordless('(music)')).toBe(true);
  });

  it('keeps words, brackets and all', () => {
    expect(isWordless('Open the star map.')).toBe(false);
    expect(isWordless('[x] marks the spot')).toBe(false);
  });
});
