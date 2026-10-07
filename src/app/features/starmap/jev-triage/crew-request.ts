import { OpenItem } from '../../../core/assistant/open-items';
import { itemsMeantBy } from '../../../core/assistant/question-answer';
import { wordsOf } from '../../../core/assistant/spoken-numbers';
import { POLITE } from './queue-command';

/** Which pull request a request for a crew means. */
export type CrewPick =
  | { readonly kind: 'one'; readonly pull: OpenItem }
  /** Several fit what was said. */
  | { readonly kind: 'which'; readonly pulls: readonly OpenItem[] }
  /** None of the pull requests Jev just listed fits. */
  | { readonly kind: 'unmatched'; readonly listed: readonly OpenItem[] }
  /** Too many fit to name, with no list to choose from. */
  | { readonly kind: 'number' };

const CREW_NOUNS: ReadonlySet<string> = new Set(['crew', 'crews']);
const CREW_VERBS: ReadonlySet<string> = new Set([
  'send', 'assign', 'get', 'put', 'dispatch', 'launch', 'have',
]); // prettier-ignore
/** Words round the crew that say nothing about which pull request:
 *  "assign it to a crew member", "get a crew on it to fix it". */
const CREW_WORDS: ReadonlySet<string> = new Set([
  ...CREW_NOUNS, ...CREW_VERBS,
  'member', 'members', 'ship', 'a', 'to', 'on', 'onto', 'at', 'out', 'fix', 'rebase', 'work',
]); // prettier-ignore

/** The most pull requests Jev names when asking which one. */
const MOST_NAMED = 3;

export const ASK_NUMBER = 'Which pull request? Say its number, as in “send a crew to 412”.';

/** The words of a request for a crew, less the crew's own, which leaves what
 *  says which pull request; null when the words ask for no crew. */
export function crewReferenceOf(said: string): string | null {
  const words = wordsOf(said).filter((word) => !POLITE.has(word));
  const isCrewAsked =
    words.some((word) => CREW_NOUNS.has(word)) && words.some((word) => CREW_VERBS.has(word));
  return isCrewAsked ? words.filter((word) => !CREW_WORDS.has(word)).join(' ') : null;
}

const pickOf = (pulls: readonly OpenItem[]): CrewPick =>
  pulls.length === 1 ? { kind: 'one', pull: pulls[0] } : { kind: 'which', pulls };

/**
 * Which pull request `reference` means: one of those Jev just `listed` first,
 * by number, place in the list, project or title words, else any `open` one.
 * Null when a word in it says nothing about a pull request, so the words can
 * go on to the router as a request of their own.
 */
export function crewPickOf(
  reference: string,
  listed: readonly OpenItem[],
  open: readonly OpenItem[],
): CrewPick | null {
  const fromList = listed.length ? itemsMeantBy(reference, listed) : null;
  if (fromList?.length) return pickOf(fromList);
  const fromOpen = itemsMeantBy(reference, open);
  if (!fromOpen) return fromList && { kind: 'unmatched', listed };
  if (!fromOpen.length) return listed.length ? { kind: 'unmatched', listed } : { kind: 'number' };
  return fromOpen.length > MOST_NAMED ? { kind: 'number' } : pickOf(fromOpen);
}

/** How a question names a pull request it offers: "alpha pull request 12 (“Fix login”)". */
const candidateOf = ({ label, number, title }: OpenItem): string =>
  `${label} pull request ${number}${title ? ` (“${title}”)` : ''}`;

/** "A, B or C". */
function anyOf(pulls: readonly OpenItem[]): string {
  const names = pulls.map(candidateOf);
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
}

/** What Jev asks when the words settle on no one pull request. */
export function whichWords(pick: Exclude<CrewPick, { readonly kind: 'one' }>): string {
  if (pick.kind === 'which') return `Which one: ${anyOf(pick.pulls)}?`;
  if (pick.kind === 'unmatched') {
    return `I can’t tell which one that is. Is it ${anyOf(pick.listed)}?`;
  }
  return ASK_NUMBER;
}
