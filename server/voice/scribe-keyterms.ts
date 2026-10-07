/** Scribe's limits on one keyterm (API reference, speech-to-text): fewer
 *  than 50 characters, at most five words, and none of these characters. */
const MAX_CHARACTERS = 49;
const MAX_WORDS = 5;
const UNSUPPORTED = /[<>{}[\]\\]/;

/** Scribe takes up to 1,000 keyterms, but bills a request carrying more than
 *  100 as at least 20 seconds of audio, however short the recording. */
export const MAX_KEYTERMS = 100;

const isScribeKeyterm = (term: string): boolean =>
  term.length > 0 &&
  term.length <= MAX_CHARACTERS &&
  term.split(' ').length <= MAX_WORDS &&
  !UNSUPPORTED.test(term);

/** The terms Scribe will take, in the order given, the first 100 at most. */
export function scribeKeyterms(terms: readonly string[]): string[] {
  return terms
    .map((term) => term.trim().replace(/\s+/g, ' '))
    .filter(isScribeKeyterm)
    .slice(0, MAX_KEYTERMS);
}
