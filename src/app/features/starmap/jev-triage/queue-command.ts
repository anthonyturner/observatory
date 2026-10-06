import { numberAt, wordsOf } from '../../../core/assistant/spoken-numbers';
import { SnoozeUntil, snoozeUntilOf } from './snooze-until';

/** A project a command can name. */
export interface NamedProject {
  readonly name: string;
  readonly repo: string;
}

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

/** Words any command may carry and still be one: "Jev, please dismiss 412". */
const POLITE: ReadonlySet<string> = new Set([
  'hey', 'jev', 'please', 'thanks', 'ok', 'okay', 'can', 'could', 'would', 'you', 'just', 'now',
]); // prettier-ignore
/** What may stand round a project's name: "in observatory". */
const PROJECT_WORDS: ReadonlySet<string> = new Set(['in', 'on', 'for', 'from', 'of', 'project']);

const BLOCKING_WORDS: ReadonlySet<string> = new Set(['blocking', 'blocked', 'stuck']);
const BLOCKING_FILLER: ReadonlySet<string> = new Set([
  'what', "what's", 'whats', 'which', 'is', 'are', 'anything', 'the', 'my', 'me', 'tell', 'top',
  'three', 'queue', 'queues', 'review', 'pull', 'requests', 'prs', 'right', 'today',
]); // prettier-ignore

/** "next star", "next PR", "next pull request". */
const NEXT_TARGETS: readonly (readonly string[])[] = [['star'], ['pr'], ['pull', 'request']];
const NEXT_FILLER: ReadonlySet<string> = new Set([
  'open', 'show', 'go', 'to', 'take', 'me', 'the', 'my', 'fly', 'what', "what's", 'whats', 'is',
]); // prettier-ignore

/** "PR 412", "pull request 412", "number 412" all name 412. */
const PULL_WORDS: ReadonlySet<string> = new Set(['pr', 'pull', 'request', 'number', 'no']);

/** A request's words, less those the reader has taken. */
type Words = readonly string[];

/** The words with `project`'s name and the words round it taken out, the
 *  project named (null for none), or undefined when two projects are named. */
function withoutProject(
  words: Words,
  projects: readonly NamedProject[],
): { readonly rest: Words; readonly project: NamedProject | null } | undefined {
  const named = projects
    .map((project) => ({ project, at: indexOfRun(words, wordsOf(project.name)) }))
    .filter(({ at }) => at >= 0);
  if (named.length > 1) return undefined;
  if (!named.length) return { rest: words, project: null };
  const [{ project, at }] = named;
  const length = wordsOf(project.name).length;
  const before = PROJECT_WORDS.has(words[at - 1]) ? at - 1 : at;
  return { rest: [...words.slice(0, before), ...words.slice(at + length)], project };
}

/** Where `run` first appears in `words`, or -1. */
function indexOfRun(words: Words, run: Words): number {
  if (!run.length) return -1;
  for (let at = 0; at + run.length <= words.length; at++) {
    if (run.every((word, k) => words[at + k] === word)) return at;
  }
  return -1;
}

const allIn = (words: Words, filler: ReadonlySet<string>): boolean =>
  words.every((word) => filler.has(word));

/** The pull request number after a command word, past "PR" or "number": its
 *  value and the index after it, or null. */
function pullNumberAt(
  words: Words,
  at: number,
): { readonly pr: number; readonly end: number } | null {
  let start = at;
  while (PULL_WORDS.has(words[start]) && start < words.length - 1) start++;
  const number = numberAt(words, start);
  return number && number.value > 0 ? { pr: number.value, end: start + number.length } : null;
}

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
  const target = NEXT_TARGETS.find((run) => indexOfRun(words.slice(at + 1), run) === 0);
  if (at < 0 || !target) return false;
  const rest = [...words.slice(0, at), ...words.slice(at + 1 + target.length)];
  return allIn(rest, NEXT_FILLER);
}

/** "snooze 412 till Monday" or "dismiss 412": the command word first. */
function triageOf(words: Words, today: Date, project: NamedProject | null): QueueCommand | null {
  const [verb] = words;
  if (verb !== 'snooze' && verb !== 'dismiss') return null;
  const number = pullNumberAt(words, 1);
  if (!number) return null;
  const after = words.slice(number.end);
  if (verb === 'dismiss') return after.length ? null : { kind: 'dismiss', pr: number.pr, project };
  const until = snoozeUntilOf(after, today);
  return until && { kind: 'snooze', pr: number.pr, until, project };
}

/** What `said` asks of the Review Queue, or null when it is something else.
 *  Matched here with no model, so only plain commands match: anything left
 *  over that is not filler makes the words a request for Jev instead. */
export function queueCommandOf(
  said: string,
  projects: readonly NamedProject[],
  today: Date,
): QueueCommand | null {
  const named = withoutProject(
    wordsOf(said).filter((word) => !POLITE.has(word)),
    projects,
  );
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
