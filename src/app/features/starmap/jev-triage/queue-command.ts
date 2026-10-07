import { SpokenNumber, wordsOf } from '../../../core/assistant/spoken-numbers';
import { commandWordsOf } from './command-words';
import { NamedProject, withoutProject } from './project-mention';
import { pullNumbersAt } from './pull-number';
import { SnoozeUntil, snoozeTimeIn } from './snooze-until';

/** What a request asks of the Review Queue; `project` is null for every project. */
export type QueueCommand =
  | { readonly kind: 'blocking'; readonly project: NamedProject | null }
  | { readonly kind: 'next'; readonly project: NamedProject | null }
  | {
      readonly kind: 'snooze';
      readonly pr: number;
      readonly until: SnoozeUntil;
      readonly project: NamedProject | null;
    }
  | { readonly kind: 'dismiss'; readonly pr: number; readonly project: NamedProject | null };

export type Confirmation = 'yes' | 'no';

export type TriageVerb = 'snooze' | 'dismiss';

/** A snooze or dismissal asked for, before its time is read: the command
 *  word, and the ways the words after it read as a pull request number. */
export interface TriageAsked {
  readonly verb: TriageVerb;
  readonly numbers: readonly SpokenNumber[];
  /** Where the number starts. */
  readonly numberAt: number;
}

type Words = readonly string[];

const BLOCKING_WORDS: ReadonlySet<string> = new Set(['blocking', 'blocked', 'stuck']);
const BLOCKING_FILLER: ReadonlySet<string> = new Set([
  'what', "what's", 'whats', 'which', 'is', 'are', 'anything', 'the', 'my', 'me', 'tell', 'top',
  'three', 'queue', 'queues', 'review', 'pr', 'right', 'today', 'show', 'list', 'in', 'there',
  'currently',
]); // prettier-ignore

/** "next star", "next PR", "next pull request". */
const NEXT_TARGETS: readonly string[] = ['star', 'pr'];
const NEXT_FILLER: ReadonlySet<string> = new Set([
  'open', 'show', 'go', 'to', 'take', 'me', 'the', 'my', 'fly', 'what', "what's", 'whats', 'is',
]); // prettier-ignore

/** Words between a command and its number: "dismiss the PR, number 412". */
const PULL_WORDS: ReadonlySet<string> = new Set(['pr', 'number', 'no', 'the']);
/** Words before a command word that make it a question or a refusal, not a
 *  command: "why did you dismiss 412", "don't snooze 412". */
const NOT_ASKED: ReadonlySet<string> = new Set([
  'why', 'how', 'what', "what's", 'when', 'where', 'who', 'which', 'did', "didn't", 'does', 'should',
  "shouldn't", "don't", 'dont', 'not', 'never', 'if',
]); // prettier-ignore

const isTriageVerb = (word: string): word is TriageVerb => word === 'snooze' || word === 'dismiss';

const allIn = (words: Words, filler: ReadonlySet<string>): boolean =>
  words.every((word) => filler.has(word));

function blockingOf(words: Words): boolean {
  const found = words.filter((word) => BLOCKING_WORDS.has(word));
  return (
    found.length === 1 &&
    allIn(
      words.filter((word) => !BLOCKING_WORDS.has(word)),
      BLOCKING_FILLER,
    )
  );
}

function nextOf(words: Words): boolean {
  const at = words.indexOf('next');
  if (at < 0 || !NEXT_TARGETS.includes(words[at + 1])) return false;
  return allIn([...words.slice(0, at), ...words.slice(at + 2)], NEXT_FILLER);
}

/** The snooze or dismissal command words ask for, wherever its command word
 *  stands: "I want to snooze PR 412". Null for none, for both, or for a
 *  question or refusal about one. */
export function triageAskedOf(words: Words): TriageAsked | null {
  const verbs = words.filter(isTriageVerb);
  const at = words.findIndex(isTriageVerb);
  if (new Set(verbs).size !== 1 || words.slice(0, at).some((word) => NOT_ASKED.has(word))) {
    return null;
  }
  let numberAt = at + 1;
  while (PULL_WORDS.has(words[numberAt])) numberAt++;
  return { verb: verbs[0], numbers: pullNumbersAt(words, numberAt), numberAt };
}

/** A snooze takes the longest number that leaves a time after it, so "four
 *  twelve two weeks" is 412 for two weeks; a dismissal, the longest. */
function triageOf(words: Words, today: Date, project: NamedProject | null): QueueCommand | null {
  const asked = triageAskedOf(words);
  if (!asked?.numbers.length) return null;
  if (asked.verb === 'dismiss') return { kind: 'dismiss', pr: asked.numbers[0].value, project };
  for (const number of asked.numbers) {
    const until = snoozeTimeIn(words.slice(asked.numberAt + number.length), today);
    if (until) return { kind: 'snooze', pr: number.value, until, project };
  }
  return null;
}

/** What `said` asks of the Review Queue, or null when it is something else.
 *  Matched here with no model, after the words are tidied of speech's noise.
 *  "What's blocking?" and "next star" take only filler besides; a snooze or
 *  dismissal takes anything, as long as its pull request is plain, because
 *  Jev asks before doing either. */
export function queueCommandOf(
  said: string,
  projects: readonly NamedProject[],
  today: Date,
): QueueCommand | null {
  const named = withoutProject(commandWordsOf(said), projects);
  if (!named) return null;
  const { rest, project } = named;
  if (blockingOf(rest)) return { kind: 'blocking', project };
  if (nextOf(rest)) return { kind: 'next', project };
  return triageOf(rest, today, project);
}

const YES: ReadonlySet<string> = new Set([
  'yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'confirm', 'confirmed', 'do', 'go',
]); // prettier-ignore
const NO: ReadonlySet<string> = new Set([
  'no',
  'nope',
  'nah',
  'cancel',
  "don't",
  'dont',
  'never',
  'leave',
]);
const ANSWER_FILLER: ReadonlySet<string> = new Set([
  'it', 'ahead', 'please', 'thanks', 'thank', 'you', 'mind', 'jev', 'that', 'one',
]); // prettier-ignore

/** Whether `said` answers yes or no to Jev's question, or null when it is
 *  neither, or both. */
export function confirmationOf(said: string): Confirmation | null {
  const words = wordsOf(said);
  const isYes = words.some((word) => YES.has(word));
  const isNo = words.some((word) => NO.has(word));
  const rest = words.filter((word) => !YES.has(word) && !NO.has(word));
  if (isYes === isNo || !allIn(rest, ANSWER_FILLER)) return null;
  return isYes ? 'yes' : 'no';
}
