import type { Collision } from '../collisions/collision-pairs.ts';
import type { CollisionCheck, CollisionsReport } from '../collisions/collisions-report.ts';
import { repoKey } from '../store/store.ts';
import type { UsageReport } from '../usage/usage-types.ts';

/**
 * What only a machine with a checkout and Claude Code's files can know, as a
 * push leaves it in the hosted site's store: the real merge checks between
 * branches, and Claude Code's usage. Each arrives over the network, so each
 * is checked here, once, before anything reads it.
 */
export const USAGE_KEY = 'usage/current';
export const collisionsKey = (repo: string): string => `collisions/${repoKey(repo)}`;

type Node = Readonly<Record<string, unknown>>;

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null;
const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((each) => typeof each === 'string');
const CHECKS: readonly CollisionCheck[] = ['checked', 'no-clone', 'unreachable'];

const isCollision = (value: unknown): value is Collision =>
  isNode(value) &&
  typeof value['a'] === 'number' &&
  typeof value['b'] === 'number' &&
  isStrings(value['files']) &&
  (value['conflicts'] === null || isStrings(value['conflicts']));

/** A pushed collisions report, or null if `value` is not one. */
export function collisionsFrom(value: unknown): CollisionsReport | null {
  if (!isNode(value)) return null;
  const { generatedAt, repo, check, pairs } = value;
  const valid =
    typeof generatedAt === 'string' &&
    typeof repo === 'string' &&
    CHECKS.includes(check as CollisionCheck) &&
    Array.isArray(pairs) &&
    pairs.every(isCollision);
  return valid ? (value as unknown as CollisionsReport) : null;
}

/** A pushed usage report, or null if `value` is not one. The page checks every reading again. */
export function usageFrom(value: unknown): UsageReport | null {
  if (!isNode(value) || typeof value['generatedAt'] !== 'string') return null;
  const tokens = value['tokens'];
  const hasRows = isNode(tokens) && Array.isArray(tokens['rows']);
  return hasRows && (value['limits'] === null || isNode(value['limits']))
    ? (value as unknown as UsageReport)
    : null;
}

const pairKey = (pair: { readonly a: number; readonly b: number }): string => `${pair.a}-${pair.b}`;

/**
 * The live pairs, which the hosted site works out from the files open pull
 * requests share, with the conflicts a push last found for each. A pair the
 * push did not check stays unchecked, never called safe, and the report says
 * `checked` only when every pair was.
 */
export function withPushedConflicts(
  live: CollisionsReport,
  pushed: CollisionsReport | null,
): CollisionsReport {
  if (!pushed || pushed.check !== 'checked') return live;
  const found = new Map(pushed.pairs.map((pair) => [pairKey(pair), pair.conflicts]));
  const pairs = live.pairs.map((pair) => ({
    ...pair,
    conflicts: found.get(pairKey(pair)) ?? null,
  }));
  const allChecked = pairs.every((pair) => pair.conflicts !== null);
  return { ...live, check: allChecked ? 'checked' : live.check, pairs };
}
