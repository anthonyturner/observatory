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

/** Reads a number from `words[at]` on, or null when none starts there. */
type NumberReader = (words: readonly string[], at: number) => SpokenNumber | null;

/** A number under a hundred, in words: "twelve", "forty two". */
const smallAt: NumberReader = (words, at) => {
  const word = words[at] ?? '';
  const tens = TENS.get(word);
  if (tens !== undefined) {
    const unit = UNITS.get(words[at + 1] ?? '');
    return unit === undefined ? { value: tens, length: 1 } : { value: tens + unit, length: 2 };
  }
  const single = TEENS.get(word) ?? UNITS.get(word);
  return single === undefined ? null : { value: single, length: 1 };
};

/** A count of `scale`, then "and" and a smaller number when one follows:
 *  "four hundred and twelve", "twelve hundred", "two thousand". */
const scaled =
  (scaleWord: string, scale: number, rest: NumberReader): NumberReader =>
  (words, at) => {
    const count = smallAt(words, at);
    if (!count || words[at + count.length] !== scaleWord) return null;
    const head = { value: count.value * scale, length: count.length + 1 };
    const and = words[at + head.length] === 'and' ? 1 : 0;
    const tail = rest(words, at + head.length + and);
    return tail && tail.value < scale
      ? { value: head.value + tail.value, length: head.length + and + tail.length }
      : head;
  };

const withHundreds = scaled('hundred', 100, smallAt);
const hundredsAt: NumberReader = (words, at) => withHundreds(words, at) ?? smallAt(words, at);
const withThousands = scaled('thousand', 1000, hundredsAt);
const thousandsAt: NumberReader = (words, at) => withThousands(words, at) ?? hundredsAt(words, at);

/** The number starting at `words[at]`, in digits or in words up to nine
 *  thousand nine hundred and ninety-nine, or null when there is none. */
export function numberAt(words: readonly string[], at: number): SpokenNumber | null {
  const word = words[at] ?? '';
  return isDigits(word) ? { value: Number(word), length: 1 } : thousandsAt(words, at);
}

/** The most digits a number said in groups runs to: a pull request number. */
const MOST_GROUPED_DIGITS = 4;
/** A 0 inside a number said in groups: "four oh nine". */
const ZERO_WORDS: ReadonlySet<string> = new Set(['oh', 'o', 'zero']);
const GROUP_DIGITS = /^\d{1,2}$/;

/** One group of a number said in groups, as its digits. */
interface DigitGroup {
  readonly digits: string;
  readonly length: number;
}

/** A group that may start a number said in groups: one under a hundred. */
function groupAt(words: readonly string[], at: number): DigitGroup | null {
  const word = words[at] ?? '';
  if (GROUP_DIGITS.test(word)) return { digits: word, length: 1 };
  const small = smallAt(words, at);
  return small && { digits: String(small.value), length: small.length };
}

/** A group after the first, which may also be a 0. */
const laterGroupAt = (words: readonly string[], at: number): DigitGroup | null =>
  ZERO_WORDS.has(words[at] ?? '') ? { digits: '0', length: 1 } : groupAt(words, at);

/** The ways the words from `at` read as a number said in groups, as people
 *  say a pull request number: "four twelve" is 412, "twelve thirty four"
 *  1234. Each reading takes two groups or more, longest first; none when
 *  fewer than two groups start there. */
export function groupedNumbersAt(words: readonly string[], at: number): SpokenNumber[] {
  const readings: SpokenNumber[] = [];
  let digits = '';
  let length = 0;
  let group = groupAt(words, at);
  while (group && digits.length + group.digits.length <= MOST_GROUPED_DIGITS) {
    digits += group.digits;
    length += group.length;
    readings.push({ value: Number(digits), length });
    group = laterGroupAt(words, at + length);
  }
  return readings.slice(1).reverse();
}
