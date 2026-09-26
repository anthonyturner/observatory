import { loadedFraction, loadingWords, restingLine } from './load-words';

describe('loadingWords', () => {
  const speech = { what: 'speech model', expectedMb: 80, isCached: false };

  it('counts a first download against the size expected until the real total passes it', () => {
    expect(loadingWords(speech, 20e6, 30e6)).toBe(
      'Downloading the speech model · 20 of 80 MB · first time only',
    );
    expect(loadingWords(speech, 20e6, 100e6)).toBe(
      'Downloading the speech model · 20 of 100 MB · first time only',
    );
  });

  it('says loading when the browser has it, and getting ready once all has come', () => {
    expect(loadingWords({ ...speech, isCached: true }, 1e6, 80e6)).toBe('Loading the speech model');
    expect(loadingWords(speech, 80e6, 80e6)).toBe('Getting the speech model ready');
  });

  it('never goes past the whole', () => {
    expect(loadedFraction(80, 40e6, 0)).toBe(0.5);
    expect(loadedFraction(80, 90e6, 90e6)).toBe(1);
  });
});

describe('restingLine', () => {
  it('says nothing, one line, or one line for both on the card', () => {
    expect(restingLine([])).toBe('');
    expect(restingLine(['Voice model ready · graphics card'])).toBe(
      'Voice model ready · graphics card',
    );
    expect(
      restingLine(['Speech model ready · graphics card', 'Voice model ready · graphics card']),
    ).toBe('Speech and voice models ready · graphics card');
  });

  it('joins lines that differ as sentences', () => {
    expect(restingLine(['Speech model ready · graphics card', 'Slower, but it works.'])).toBe(
      'Speech model ready · graphics card. Slower, but it works.',
    );
  });
});
