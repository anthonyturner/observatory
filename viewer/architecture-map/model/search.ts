import type { ArchitectureNode } from '../../../server/architecture/architecture-types.ts';

/** A stretch of the matched text, from `start` up to but not including `end`. */
export type Range = readonly [start: number, end: number];

export interface SearchHit {
  readonly node: ArchitectureNode;
  readonly score: number;
  /** Where in `node.name` the query landed, merged and in order, for highlighting. */
  readonly nameRanges: readonly Range[];
}

/** Scoring weights, tuned so a typed prefix or camelCase initials beat letters scattered through a name. */
const WORD_START_BONUS = 8;
const CONSECUTIVE_BONUS = 6;
const GAP_PENALTY = 1;
const LEADING_GAP_PENALTY = 0.3;
const FIRST_CHAR_BONUS = 4;
const SUBSTRING_BASE = 100;
const SUBSTRING_PREFIX_BONUS = 40;
const SUBSTRING_WORD_BONUS = 25;
const WHOLE_TEXT_BONUS = 60;
const LENGTH_PENALTY = 0.5;

/** How much a match in each searchable field is worth next to a match in the name. */
const NAME_WEIGHT = 1;
const FILE_WEIGHT = 0.35;
const KIND_WEIGHT = 0.25;

const SEPARATORS = /[\s/\\._\-:#[\]()]/;

/** Whether `index` starts a word: after a separator, or where a capital follows a lower-case letter. */
function startsWord(text: string, index: number): boolean {
  if (index === 0) return true;
  const before = text.charAt(index - 1);
  if (SEPARATORS.test(before)) return true;
  const here = text.charAt(index);
  return before === before.toLowerCase() && here !== here.toLowerCase();
}

interface Match {
  readonly score: number;
  readonly ranges: readonly Range[];
}

function mergeRanges(ranges: readonly Range[]): Range[] {
  const merged: [number, number][] = [];
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

function substringMatch(text: string, lower: string, token: string): Match | null {
  const at = lower.indexOf(token);
  if (at < 0) return null;
  const bonus = at === 0 ? SUBSTRING_PREFIX_BONUS : startsWord(text, at) ? SUBSTRING_WORD_BONUS : 0;
  const whole = text.length === token.length ? WHOLE_TEXT_BONUS : 0;
  const score = SUBSTRING_BASE + bonus + whole - (text.length - token.length) * LENGTH_PENALTY;
  return { score, ranges: [[at, at + token.length]] };
}

const NONE = Number.NEGATIVE_INFINITY;

/**
 * The best way to lay `token`'s letters, in order, over `text`: scored for landing on word
 * starts and on neighbouring letters, penalised for the letters skipped between.
 */
function subsequenceMatch(text: string, lower: string, token: string): Match | null {
  const n = lower.length;
  const m = token.length;
  if (m > n) return null;
  const scores: number[][] = [];
  const came: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row = new Array<number>(n).fill(NONE);
    const from = new Array<number>(n).fill(-1);
    const previous = scores[i - 1];
    let gapBest = NONE;
    let gapAt = -1;
    for (let j = 0; j < n; j++) {
      gapBest -= GAP_PENALTY;
      const skipping = previous && j >= 2 ? (previous[j - 2] ?? NONE) - GAP_PENALTY : NONE;
      if (skipping >= gapBest) {
        gapBest = skipping;
        gapAt = j - 2;
      }
      if (lower.charAt(j) !== token.charAt(i)) continue;
      const own =
        1 + (startsWord(text, j) ? WORD_START_BONUS : 0) + (j === 0 ? FIRST_CHAR_BONUS : 0);
      if (!previous) {
        row[j] = own - j * LEADING_GAP_PENALTY;
      } else {
        const adjacent = j >= 1 ? (previous[j - 1] ?? NONE) + CONSECUTIVE_BONUS : NONE;
        const best = Math.max(adjacent, gapBest);
        if (best > NONE) {
          row[j] = best + own;
          from[j] = adjacent >= gapBest ? j - 1 : gapAt;
        }
      }
    }
    scores.push(row);
    came.push(from);
  }
  const last = scores[m - 1] ?? [];
  const end = last.reduce((bestAt, value, j) => (value > (last[bestAt] ?? NONE) ? j : bestAt), 0);
  const total = last[end] ?? NONE;
  if (total === NONE) return null;
  const ranges: Range[] = [];
  let at = end;
  for (let i = m - 1; i >= 0 && at >= 0; i--) {
    ranges.push([at, at + 1]);
    at = came[i]?.[at] ?? -1;
  }
  return { score: total, ranges: mergeRanges(ranges) };
}

/** A token's best match in one text: an exact stretch is worth far more than scattered letters. */
function matchToken(text: string, token: string, scattered: boolean): Match | null {
  const lower = text.toLowerCase();
  return (
    substringMatch(text, lower, token) ?? (scattered ? subsequenceMatch(text, lower, token) : null)
  );
}

interface Searchable {
  readonly text: string;
  readonly weight: number;
  readonly isName: boolean;
}

/** Only a name may match by scattered letters; letters spread over a path match nearly anything. */

function searchableFields(node: ArchitectureNode): Searchable[] {
  return [
    { text: node.name, weight: NAME_WEIGHT, isName: true },
    { text: node.file, weight: FILE_WEIGHT, isName: false },
    { text: node.kind, weight: KIND_WEIGHT, isName: false },
  ];
}

interface TokenMatch {
  readonly weighted: number;
  readonly ranges: readonly Range[];
  readonly isName: boolean;
}

function bestFieldMatch(node: ArchitectureNode, token: string): TokenMatch | null {
  let best: TokenMatch | null = null;
  for (const field of searchableFields(node)) {
    const match = field.text === '' ? null : matchToken(field.text, token, field.isName);
    const weighted = match ? match.score * field.weight : NONE;
    if (match && (!best || weighted > best.weighted)) {
      best = { weighted, ranges: match.ranges, isName: field.isName };
    }
  }
  return best;
}

function scoreNode(node: ArchitectureNode, tokens: readonly string[]): SearchHit | null {
  let score = 0;
  const nameRanges: Range[] = [];
  for (const token of tokens) {
    const best = bestFieldMatch(node, token);
    if (!best) return null;
    score += best.weighted;
    if (best.isName) nameRanges.push(...best.ranges);
  }
  return { node, score, nameRanges: mergeRanges(nameRanges) };
}

/**
 * Nodes whose name, file or kind contain every word of `query`, letters in order
 * ("qstore" finds QueueStore), best first. An empty query finds nothing.
 */
export function searchNodes(
  nodes: readonly ArchitectureNode[],
  query: string,
  limit: number,
): SearchHit[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  return nodes
    .flatMap((node) => scoreNode(node, tokens) ?? [])
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.node.name.length - b.node.name.length ||
        a.node.id.localeCompare(b.node.id),
    )
    .slice(0, limit);
}
