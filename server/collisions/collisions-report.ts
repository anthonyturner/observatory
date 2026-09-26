import { mapWithLimit } from '../util/map-with-limit.ts';
import type { CloneFinder } from './clone-finder.ts';
import { type Collision, type PullFiles, sharedPairs } from './collision-pairs.ts';
import type { PairMerger } from './pair-merger.ts';

/** What collision courses need from GitHub. */
export interface FilesReader {
  /** Each open pull request and the files it changes. */
  pullFiles(repo: string): Promise<PullFiles[]>;
}

/** Whether the pairs were merged: in a clone, or not, and why. */
export type CollisionCheck = 'checked' | 'no-clone' | 'unreachable';

/** What `GET /api/collisions` returns. */
export interface CollisionsReport {
  readonly generatedAt: string;
  readonly repo: string;
  readonly check: CollisionCheck;
  readonly pairs: readonly Collision[];
}

const MERGE_CONCURRENCY = 4;

const unchecked = (pairs: ReturnType<typeof sharedPairs>): Collision[] =>
  pairs.map((pair) => ({ ...pair, conflicts: null }));

/**
 * Every pair of open pull requests that change a file in common, merged in a
 * local clone to see which would conflict. Without a clone they are unchecked,
 * never called safe. The fetched refs are removed however the merging ends.
 */
export async function collisionsReport(
  github: FilesReader,
  clones: CloneFinder,
  merger: PairMerger,
  repo: string,
  now = Date.now(),
): Promise<CollisionsReport> {
  const pairs = sharedPairs(await github.pullFiles(repo));
  const report = (check: CollisionCheck, collisions: Collision[]): CollisionsReport => ({
    generatedAt: new Date(now).toISOString(),
    repo,
    check,
    pairs: collisions,
  });
  const clone = await clones.cloneOf(repo);
  if (!clone) return report('no-clone', unchecked(pairs));
  if (!pairs.length) return report('checked', []);

  const pulls = [...new Set(pairs.flatMap((pair) => [pair.a, pair.b]))];
  const session = await merger.open(clone, pulls).catch(() => null);
  if (!session) return report('unreachable', unchecked(pairs));
  try {
    const conflicts = await mapWithLimit(pairs, MERGE_CONCURRENCY, (pair) =>
      session.conflicts(pair.a, pair.b),
    );
    return report(
      'checked',
      pairs.map((pair, index) => ({ ...pair, conflicts: conflicts[index] })),
    );
  } finally {
    await session.close().catch(() => undefined);
  }
}
