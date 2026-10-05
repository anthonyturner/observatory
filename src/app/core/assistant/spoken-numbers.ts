/** A number read from a transcript, and how many words it took. */
export interface SpokenNumber {
  readonly value: number;
  readonly length: number;
}

const UNITS: ReadonlyMap<string, number> = new Map([
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
]);

const TEENS: ReadonlyMap<string, number> = new Map([
  ['ten', 10],
  ['eleven', 11],
  ['twelve', 12],
  ['thirteen', 13],
  ['fourteen', 14],
  ['fifteen', 15],
  ['sixteen', 16],
  ['seventeen', 17],
  ['eighteen', 18],
  ['nineteen', 19],
]);

const TENS: ReadonlyMap<string, number> = new Map([
  ['twenty', 20],
  ['thirty', 30],
  ['forty', 40],
  ['fifty', 50],
  ['sixty', 60],
  ['seventy', 70],
  ['eighty', 80],
  ['ninety', 90],
]);

const DIGITS = /^\d+$/;

export const isDigits = (word: string | undefined): boolean => DIGITS.test(word ?? '');

/** The words of a transcript, as the matcher compares them: lower case, with
 *  punctuation, "#" and hyphens gone, so "Number 12.", "#12" and
 *  "twenty-one" read as plain words. */
export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .split(' ')
    .filter(Boolean);
}

/** The number starting at `words[at]`, in digits or in words up to
 *  ninety-nine, or null when there is none. */
export function numberAt(words: readonly string[], at: number): SpokenNumber | null {
  const word = words[at] ?? '';
  if (isDigits(word)) return { value: Number(word), length: 1 };
  const tens = TENS.get(word);
  if (tens !== undefined) {
    const unit = UNITS.get(words[at + 1] ?? '');
    return unit === undefined ? { value: tens, length: 1 } : { value: tens + unit, length: 2 };
  }
  const single = TEENS.get(word) ?? UNITS.get(word);
  return single === undefined ? null : { value: single, length: 1 };
}
