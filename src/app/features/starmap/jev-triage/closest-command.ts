import { commandWordsOf } from './command-words';
import { triageAskedOf } from './queue-command';

/** The pull request a suggestion names when the words gave none. */
const EXAMPLE_PR = 412;
const EXAMPLE_TIME = 'till Monday';

/** A command Jev can carry out, offered for words it could not. */
export interface ClosestCommand {
  readonly words: string;
  /** Whether its pull request number is the one heard, not an example. */
  readonly isNumberHeard: boolean;
}

/** The command Jev offers for words that sound like a snooze or a dismissal
 *  it could not carry out, as in "snooze 412 till the cows come home": the
 *  same command, put the way Jev hears it. Null for words that do not:
 *  those with no snooze or dismissal in them, or one about no pull request,
 *  as in "dismiss the banner", which goes to Jev as a request. */
export function closestCommandTo(said: string): ClosestCommand | null {
  const words = commandWordsOf(said);
  const asked = triageAskedOf(words);
  const [number] = asked?.numbers ?? [];
  const isAboutPull = !!number || words.includes('pr') || words.length === 1;
  if (!asked || !isAboutPull) return null;
  const pr = number?.value ?? EXAMPLE_PR;
  return {
    words: asked.verb === 'snooze' ? `snooze ${pr} ${EXAMPLE_TIME}` : `dismiss ${pr}`,
    isNumberHeard: !!number,
  };
}

/** What Jev says when it heard a command it could not carry out. */
export function heardWords(said: string, closest: ClosestCommand): string {
  const offer = closest.isNumberHeard
    ? `Did you mean “${closest.words}”?`
    : `Say it with the pull request’s number, as in “${closest.words}”.`;
  return `I heard: “${said}”. ${offer}`;
}
