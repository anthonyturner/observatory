import { isDigits, wordsOf } from '../../../core/assistant/spoken-numbers';
import { WEEKDAYS } from './snooze-until';

type Words = readonly string[];
/** One pass over a request's words, tidying one kind of noise. */
type WordStep = (words: Words) => Words;

/** A run of words that says one thing another way. */
interface Phrase {
  readonly run: Words;
  readonly meant: Words;
}

/** Longer runs first, so "p r s" is read before "p r". */
const PHRASES: readonly Phrase[] = [
  { run: ['i', 'would', 'like', 'to'], meant: [] },
  { run: ["i'd", 'like', 'to'], meant: [] },
  { run: ['i', 'want', 'to'], meant: [] },
  { run: ['go', 'ahead', 'and'], meant: [] },
  { run: ['pull', 'requests'], meant: ['pr'] },
  { run: ['pull', 'request'], meant: ['pr'] },
  { run: ['p', 'r', 's'], meant: ['pr'] },
  { run: ['p', 'r'], meant: ['pr'] },
  { run: ['dis', 'miss'], meant: ['dismiss'] },
  { run: ['thank', 'you'], meant: [] },
];

/** Words that carry no command: fillers, courtesies, and Jev's name as
 *  speech-to-text tends to hear it. */
const FILLER: ReadonlySet<string> = new Set([
  'um', 'uh', 'er', 'erm', 'hmm', 'so', 'hey', 'jev', 'jeff', 'jeb', 'please', 'thanks', 'ok',
  'okay', 'can', 'could', 'would', 'you', 'just', 'now', 'i', 'wanna',
]); // prettier-ignore

/** Other forms of a command word, and the slips speech-to-text makes in it. */
const FORMS: ReadonlyMap<string, string> = new Map([
  ['snoozed', 'snooze'],
  ['snoozes', 'snooze'],
  ['snoozing', 'snooze'],
  ['snoose', 'snooze'],
  ['snoosed', 'snooze'],
  ['snooz', 'snooze'],
  ['dismissed', 'dismiss'],
  ['dismisses', 'dismiss'],
  ['dismissing', 'dismiss'],
  ['dismis', 'dismiss'],
  ['prs', 'pr'],
  ["pr's", 'pr'],
]);

/** "pr412", as a transcript may run them together. */
const GLUED_PR = /^pr(\d+)$/;

/** A word that sounds like another, which it means only where the words round it say so. */
interface Homophone {
  readonly heard: ReadonlySet<string>;
  readonly meant: string;
  readonly fits: (words: Words, at: number) => boolean;
}

const ARTICLES: ReadonlySet<string> = new Set(['a', 'an', 'the']);
const CREW_SENDERS: ReadonlySet<string> = new Set(['send', 'assign', 'dispatch']);
/** What may follow a crew sent: "send a crew to 412", "assign a crew member". */
const AFTER_CREW: ReadonlySet<string> = new Set(['to', 'on', 'onto', 'at', 'for', 'member', 'pr']);
/** What may follow "till" in a snooze: "till Monday", "till next week". */
const AFTER_TILL: ReadonlySet<string> = new Set([
  ...WEEKDAYS,
  'tomorrow',
  'next',
  'this',
  'coming',
]);

/** "send a through to 412" is a crew; "go through 412" is not. */
const isCrewSent = (words: Words, at: number): boolean => {
  const verbAt = ARTICLES.has(words[at - 1]) ? at - 2 : at - 1;
  const next = words[at + 1];
  return (
    CREW_SENDERS.has(words[verbAt]) &&
    (next === undefined || AFTER_CREW.has(next) || isDigits(next))
  );
};

/** "snooze 412 tell Monday" is till Monday; "tell me what's blocking" is not. */
const isSnoozeTime = (words: Words, at: number): boolean =>
  words.slice(0, at).includes('snooze') && AFTER_TILL.has(words[at + 1]);

const HOMOPHONES: readonly Homophone[] = [
  { heard: new Set(['through', 'true', 'cru', 'crue']), meant: 'crew', fits: isCrewSent },
  { heard: new Set(['tell', 'teal']), meant: 'till', fits: isSnoozeTime },
];

const unglued: WordStep = (words) =>
  words.flatMap((word) => {
    const glued = GLUED_PR.exec(word);
    return glued ? ['pr', glued[1]] : [word];
  });

const rephrased: WordStep = (words) => {
  const said: string[] = [];
  for (let at = 0; at < words.length;) {
    const phrase = PHRASES.find(({ run }) => run.every((word, k) => words[at + k] === word));
    said.push(...(phrase?.meant ?? [words[at]]));
    at += phrase?.run.length ?? 1;
  }
  return said;
};

const unfilled: WordStep = (words) => words.filter((word) => !FILLER.has(word));

const plainForms: WordStep = (words) => words.map((word) => FORMS.get(word) ?? word);

const heardRight: WordStep = (words) =>
  words.map(
    (word, at) =>
      HOMOPHONES.find((each) => each.heard.has(word) && each.fits(words, at))?.meant ?? word,
  );

const STEPS: readonly WordStep[] = [unglued, rephrased, unfilled, plainForms, heardRight];

/** The words of a spoken or typed request as the Review Queue's commands
 *  read them: with fillers and Jev's name gone, "p r" and "pull request" as
 *  "pr", each command word in one form, and words misheard for a command
 *  word put right where the words round them show it. */
export function commandWordsOf(said: string): string[] {
  return [...STEPS.reduce<Words>((words, step) => step(words), wordsOf(said))];
}
