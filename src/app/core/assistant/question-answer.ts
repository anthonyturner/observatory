import { OpenItem, OpenKind } from './open-items';
import { isDigits, numberAt, wordsOf } from './spoken-numbers';

/** Why an answer could not settle on one item: "yes" with several on the
 *  card, or words that point at none of them or at more than one. */
export type UnclearWhy = 'several' | 'unmatched';

/** What spoken words said to Jev's question. Speech can only ever open one
 *  item, be unclear, ask for all of them, or say no. */
export type QuestionAnswer =
  | { readonly kind: 'open'; readonly item: OpenItem }
  | { readonly kind: 'unclear'; readonly why: UnclearWhy }
  | { readonly kind: 'all' }
  | { readonly kind: 'no' };

/** Whether an item fits one thing said about it ("12", "the first one"). */
type Clue = (item: OpenItem, index: number, items: readonly OpenItem[]) => boolean;

type Reply = 'yes' | 'no' | 'all';

/** What the words said so far, as they are read left to right. */
interface Heard {
  readonly clues: Clue[];
  readonly replies: Set<Reply>;
}

/** What a reader needs besides the words: each title word and each project
 *  name word, with the items that hold it, and whether the items' order
 *  means anything, so that "the first one" can name one. */
interface Card {
  readonly titleWords: ReadonlyMap<string, readonly number[]>;
  readonly projectWords: ReadonlyMap<string, readonly number[]>;
  readonly hasPlaces: boolean;
}

/** Reads the words starting at `at` into `heard`, and says how many it took:
 *  0 when they are not its kind of words. */
type Reader = (words: readonly string[], at: number, heard: Heard, card: Card) => number;

const KIND_WORDS: ReadonlyMap<string, OpenKind> = new Map([
  ['pull', 'pull'],
  ['pr', 'pull'],
  ['issue', 'issue'],
]);

const ORDINALS: ReadonlyMap<string, number> = new Map([
  ['first', 0],
  ['1st', 0],
  ['second', 1],
  ['2nd', 1],
  ['third', 2],
  ['3rd', 2],
  ['fourth', 3],
  ['4th', 3],
  ['fifth', 4],
  ['5th', 4],
]);

const REPLY_WORDS: ReadonlyMap<string, Reply> = new Map([
  ['yes', 'yes'],
  ['yeah', 'yes'],
  ['yep', 'yes'],
  ['yup', 'yes'],
  ['sure', 'yes'],
  ['ok', 'yes'],
  ['okay', 'yes'],
  ['no', 'no'],
  ['nope', 'no'],
  ['nah', 'no'],
  ['all', 'all'],
  ['both', 'all'],
]);

/** Words that say nothing about which item, so an answer may carry them:
 *  "open the first one, please". A word outside every list makes the words a
 *  request rather than an answer. */
const FILLER: ReadonlySet<string> = new Set([
  'the',
  'a',
  'an',
  'it',
  'them',
  'that',
  'this',
  'one',
  'ones',
  'of',
  'open',
  'show',
  'me',
  'please',
  'thanks',
  'thank',
  'you',
  'and',
  'or',
  'just',
  'um',
  'uh',
  'er',
  'oh',
  'request',
  'number',
  'about',
  'with',
  'in',
  'from',
]);

const sameNumber =
  (number: number): Clue =>
  (item) =>
    item.number === number;

const sameKind =
  (kind: OpenKind): Clue =>
  (item) =>
    item.kind === kind;

const both =
  (first: Clue, second: Clue): Clue =>
  (item, index, items) =>
    first(item, index, items) && second(item, index, items);

/** "pull request 12", "PR 12", "issue 12", or the kind alone ("the issue").
 *  Only the singular: "open pull requests" is a request, not an answer. */
const readKind: Reader = (words, at, heard) => {
  const kind = KIND_WORDS.get(words[at]);
  if (!kind) return 0;
  const taken = words[at + 1] === 'request' ? 2 : 1;
  const number = numberAt(words, at + taken);
  heard.clues.push(number ? both(sameKind(kind), sameNumber(number.value)) : sameKind(kind));
  return taken + (number?.length ?? 0);
};

/** "Number two" is the item numbered 2 where there is one, and otherwise the
 *  second: a list Jev reads out is numbered by place. */
const numberOrPlace =
  (number: number): Clue =>
  (item, index, items) =>
    items.some((each) => each.number === number) ? item.number === number : index === number - 1;

/** "number 12", and "No. 12", which is how a transcript may write "number". */
const readNumberWord: Reader = (words, at, heard, card) => {
  const word = words[at];
  const isNumberWord = word === 'number' || (word === 'no' && isDigits(words[at + 1]));
  const number = isNumberWord ? numberAt(words, at + 1) : null;
  if (!number) return 0;
  heard.clues.push(card.hasPlaces ? numberOrPlace(number.value) : sameNumber(number.value));
  return 1 + number.length;
};

/** A bare number. "One" counts only when it starts the words; elsewhere it
 *  is "the first one" or "that one". */
const readNumber: Reader = (words, at, heard) => {
  if (words[at] === 'one' && at > 0) return 0;
  const number = numberAt(words, at);
  if (!number) return 0;
  heard.clues.push(sameNumber(number.value));
  return number.length;
};

/** "first" to "fifth", and "the last one", in the card's order. */
const readOrdinal: Reader = (words, at, heard, card) => {
  if (!card.hasPlaces) return 0;
  const word = words[at];
  const place = ORDINALS.get(word);
  if (place !== undefined) heard.clues.push((_, index) => index === place);
  else if (word === 'last') heard.clues.push((_, index, items) => index === items.length - 1);
  else return 0;
  return 1;
};

const readReply: Reader = (words, at, heard) => {
  const reply = REPLY_WORDS.get(words[at]);
  if (!reply) return 0;
  heard.replies.add(reply);
  return 1;
};

const readFiller: Reader = (words, at) => (FILLER.has(words[at]) ? 1 : 0);

/** Whether an item is one of `holders`, by its place on the card. */
const heldBy =
  (holders: readonly number[]): Clue =>
  (_, index) =>
    holders.includes(index);

/** A word of a project's name narrows the items to that project's:
 *  "the observatory one". */
const readProjectWord: Reader = (words, at, heard, card) => {
  const holders = card.projectWords.get(words[at]);
  if (!holders) return 0;
  heard.clues.push(heldBy(holders));
  return 1;
};

/** A title word narrows the items to those whose titles hold it, so a word
 *  from one title names that item, and one from several names none alone:
 *  "the observatory one about the playlist" needs both. */
const readTitleWord: Reader = (words, at, heard, card) => {
  const holders = card.titleWords.get(words[at]);
  if (!holders) return 0;
  heard.clues.push(heldBy(holders));
  return 1;
};

/** Earlier readers win: "no" before "No. 12" would read as a refusal, and a
 *  title holding "all" still means all of them. */
const READERS: readonly Reader[] = [
  readKind,
  readNumberWord,
  readNumber,
  readOrdinal,
  readReply,
  readFiller,
  readProjectWord,
  readTitleWord,
];

/** Each word of the items' titles and projects, and which items hold it. A stand-in
 *  title ("Open the issue") is all filler and kind words, so it never
 *  matches: the readers before readTitleWord take those words first. */
function cardOf(items: readonly OpenItem[]): Card {
  return {
    titleWords: holdersOf(items.map(({ title }) => title)),
    projectWords: holdersOf(items.map(({ label }) => label)),
    hasPlaces: true,
  };
}

/** Each word of `texts`, and the indexes of the texts that hold it. */
function holdersOf(texts: readonly string[]): ReadonlyMap<string, readonly number[]> {
  const holders = new Map<string, number[]>();
  texts.forEach((text, index) => {
    for (const word of new Set(wordsOf(text))) {
      holders.set(word, [...(holders.get(word) ?? []), index]);
    }
  });
  return holders;
}

/** How many words the first reader that knows them took, or 0 when none did. */
function readAt(words: readonly string[], at: number, heard: Heard, card: Card): number {
  for (const read of READERS) {
    const taken = read(words, at, heard, card);
    if (taken) return taken;
  }
  return 0;
}

/** Everything the words say, or null when one of them is no part of an answer. */
function hear(words: readonly string[], card: Card): Heard | null {
  const heard: Heard = { clues: [], replies: new Set() };
  for (let at = 0; at < words.length;) {
    const taken = readAt(words, at, heard, card);
    if (!taken) return null;
    at += taken;
  }
  return heard;
}

/** The items that fit every clue: all of them when there are none. */
const fitting = (clues: readonly Clue[], items: readonly OpenItem[]): OpenItem[] =>
  items.filter((item, index) => clues.every((fits) => fits(item, index, items)));

function oneOf(matches: readonly OpenItem[]): QuestionAnswer {
  return matches.length === 1
    ? { kind: 'open', item: matches[0] }
    : { kind: 'unclear', why: 'unmatched' };
}

/** All of them goes first: "open all of the issues" asks for more than one.
 *  Then anything said about which item, so "no, the first one" opens it. */
function decide(heard: Heard, items: readonly OpenItem[]): QuestionAnswer | null {
  const { clues, replies } = heard;
  if (replies.has('all')) return { kind: 'all' };
  if (clues.length) return oneOf(fitting(clues, items));
  if (replies.has('no')) return { kind: 'no' };
  if (replies.has('yes'))
    return items.length === 1 ? oneOf(items) : { kind: 'unclear', why: 'several' };
  return null;
}

/** What `said` answers to Jev's question about `items`, or null when it is
 *  no answer at all and should go on as a request. Matched here, with no
 *  model: an ordinary request must never be taken for an answer. */
export function answerTo(said: string, items: readonly OpenItem[]): QuestionAnswer | null {
  if (!items.length) return null;
  const heard = hear(wordsOf(said), cardOf(items));
  return heard && decide(heard, items);
}

/** The items `said` could mean, of a list read out in order: each that fits
 *  all it says about them, or every item when it says nothing that tells them
 *  apart. Null when a word in it is no part of an answer. Yes, no and all are
 *  heard and passed over, for a caller that has its own question to ask. */
export function itemsMeantBy(said: string, items: readonly OpenItem[]): OpenItem[] | null {
  return itemsFitting(said, cardOf(items), items);
}

/** As itemsMeantBy, for items in no order anyone heard: only a number, a
 *  project or title words name one, never a place like "the first one". */
export function itemsNamedBy(said: string, items: readonly OpenItem[]): OpenItem[] | null {
  return itemsFitting(said, { ...cardOf(items), hasPlaces: false }, items);
}

function itemsFitting(said: string, card: Card, items: readonly OpenItem[]): OpenItem[] | null {
  const heard = hear(wordsOf(said), card);
  return heard && fitting(heard.clues, items);
}
