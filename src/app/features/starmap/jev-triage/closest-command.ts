import { commandWordsOf } from './command-words';
import { triageAskedOf } from './queue-command';

/** The pull request a suggestion names when the words gave none. */
const EXAMPLE_PR = 412;
const EXAMPLE_TIME = 'till Monday';

/** The command Jev offers for words that sound like a snooze or a dismissal
 *  it could not carry out, as in "snooze 412 till the cows come home": the
 *  same command, put the way Jev hears it. Null for words that do not:
 *  those with no snooze or dismissal in them, or one about no pull request,
 *  as in "dismiss the banner", which goes to Jev as a request. */
export function closestCommandTo(said: string): string | null {
  const words = commandWordsOf(said);
  const asked = triageAskedOf(words);
  const isAboutPull = !!asked?.numbers.length || words.includes('pr') || words.length === 1;
  if (!asked || !isAboutPull) return null;
  const pr = asked.numbers[0]?.value ?? EXAMPLE_PR;
  return asked.verb === 'snooze' ? `snooze ${pr} ${EXAMPLE_TIME}` : `dismiss ${pr}`;
}

/** What Jev says when it heard a command it could not carry out. */
export const heardWords = (said: string, closest: string): string =>
  `I heard: “${said}”. Did you mean “${closest}”?`;
