import { SpokenNumber, groupedNumbersAt, numberAt } from '../../../core/assistant/spoken-numbers';

/** The ways the words from `at` read as a pull request number, longest
 *  first: said in groups ("four twelve") or as a count ("four hundred and
 *  twelve", "412"). A caller that knows what follows the number picks the
 *  first reading that leaves sense after it. */
export function pullNumbersAt(words: readonly string[], at: number): SpokenNumber[] {
  const counted = numberAt(words, at);
  return [...groupedNumbersAt(words, at), ...(counted ? [counted] : [])]
    .filter((reading) => reading.value > 0)
    .sort((first, second) => second.length - first.length);
}

/** The words with each number said over several words written in digits,
 *  "four twelve" as "412", so a reader that takes one number word at a time
 *  sees one number. A one-word number stays as it is: "the first one". */
export function withNumbersInDigits(words: readonly string[]): string[] {
  const said: string[] = [];
  for (let at = 0; at < words.length;) {
    const [longest] = pullNumbersAt(words, at);
    const isSpread = longest !== undefined && longest.length > 1;
    said.push(isSpread ? String(longest.value) : words[at]);
    at += isSpread ? longest.length : 1;
  }
  return said;
}
