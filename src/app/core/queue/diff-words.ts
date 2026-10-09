/** A stretch of a line's code; `changed` when the other side of the pair lacks it. */
export interface DiffSpan {
  readonly text: string;
  readonly changed: boolean;
}

/** A pair's two lines, each cut into the stretches that differ and those that do not. */
export interface WordChanges {
  readonly removed: readonly DiffSpan[];
  readonly added: readonly DiffSpan[];
}

/** Words, runs of space, and each punctuation mark alone, so `a.b` and `a.c` share `a.`. */
const TOKEN = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;
/** The comparison grows with the product of the two lengths: a minified line is not worth it. */
const MAX_TOKENS = 240;
/** Below this share kept, the lines are rewrites and the whole-line wash says it better. */
const MIN_SHARED = 0.4;

const tokensOf = (text: string): string[] => text.match(TOKEN) ?? [];
const isSpace = (token: string): boolean => token.trim() === '';
const sizeOf = (tokens: readonly string[]): number =>
  tokens.reduce((sum, token) => sum + (isSpace(token) ? 0 : token.length), 0);

/**
 * Which words of a removed line and the added line that replaces it changed, or
 * `null` when marking them would add nothing: the lines match, are too long to
 * compare cheaply, or share too little for a word to stand out.
 */
export function wordChangesOf(removed: string, added: string): WordChanges | null {
  const before = tokensOf(removed);
  const after = tokensOf(added);
  if (before.length > MAX_TOKENS || after.length > MAX_TOKENS) return null;

  const head = commonHead(before, after);
  const tail = commonTail(before, after, head);
  const kept = sharedTokens(
    before.slice(head, before.length - tail),
    after.slice(head, after.length - tail),
  );
  const keptBefore = flagsOf(before.length, head, tail, kept.before);
  const keptAfter = flagsOf(after.length, head, tail, kept.after);

  const sharedSize = sizeOf(before.filter((_, index) => keptBefore[index]));
  const largest = Math.max(sizeOf(before), sizeOf(after));
  if (largest === 0 || sharedSize === largest || sharedSize / largest < MIN_SHARED) return null;

  return { removed: spansOf(before, keptBefore), added: spansOf(after, keptAfter) };
}

function commonHead(before: readonly string[], after: readonly string[]): number {
  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) head++;
  return head;
}

function commonTail(before: readonly string[], after: readonly string[], head: number): number {
  let tail = 0;
  while (
    tail < before.length - head &&
    tail < after.length - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail++;
  }
  return tail;
}

/** Which tokens of the middle stay, by the longest common subsequence of the two. */
function sharedTokens(
  before: readonly string[],
  after: readonly string[],
): { before: boolean[]; after: boolean[] } {
  const width = after.length + 1;
  const length = new Uint16Array((before.length + 1) * width);
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      length[i * width + j] =
        before[i] === after[j]
          ? length[(i + 1) * width + j + 1] + 1
          : Math.max(length[(i + 1) * width + j], length[i * width + j + 1]);
    }
  }

  const keptBefore = before.map(() => false);
  const keptAfter = after.map(() => false);
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      keptBefore[i++] = true;
      keptAfter[j++] = true;
    } else if (length[(i + 1) * width + j] >= length[i * width + j + 1]) i++;
    else j++;
  }
  return { before: keptBefore, after: keptAfter };
}

/** Every token's flag: the head and tail kept without being compared, the middle as compared. */
const flagsOf = (
  length: number,
  head: number,
  tail: number,
  middle: readonly boolean[],
): boolean[] =>
  Array.from({ length }, (_, index) =>
    index < head || index >= length - tail ? true : middle[index - head],
  );

/** Runs of tokens that share a flag become one span. A space between two changes joins them. */
function spansOf(tokens: readonly string[], kept: readonly boolean[]): DiffSpan[] {
  const changed = tokens.map(
    (token, index) =>
      !kept[index] || (isSpace(token) && kept[index - 1] === false && kept[index + 1] === false),
  );
  const spans: { text: string; changed: boolean }[] = [];
  tokens.forEach((token, index) => {
    const last = spans.at(-1);
    if (last?.changed === changed[index]) last.text += token;
    else spans.push({ text: token, changed: changed[index] });
  });
  return spans;
}
