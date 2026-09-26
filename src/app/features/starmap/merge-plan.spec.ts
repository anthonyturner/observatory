import { SkyPair } from './engine/collision-layer';
import { PlanPull, mergePlan } from './merge-plan';
import { planHow, planRows } from './plan-panel/plan-panel';

const pull = (
  number: number,
  head: string,
  base: string,
  mergeable: string,
  size: number,
): PlanPull => ({
  number,
  title: String.fromCharCode(96 + number),
  head,
  base,
  mergeable,
  additions: size,
  deletions: 0,
});

const pulls = [
  pull(1, 'h1', 'main', 'MERGEABLE', 10),
  pull(2, 'h2', 'h1', 'MERGEABLE', 5),
  pull(3, 'h3', 'main', 'CONFLICTING', 1),
  { ...pull(4, 'h4', 'main', 'MERGEABLE', 500), deletions: 20 },
  { ...pull(5, 'h5', 'main', 'MERGEABLE', 3), deletions: 1 },
];
const pairs: SkyPair[] = [
  { a: 1, b: 4, conflict: true },
  { a: 4, b: 5, conflict: true },
  { a: 1, b: 5, conflict: null },
  { a: 2, b: 5, conflict: false },
];

describe('mergePlan', () => {
  it('orders the queue exactly as pr-starmap’s plan() does', () => {
    // pr-starmap's bin/collisions.mjs plan(), run on the same pull requests and pairs.
    expect(mergePlan(pulls, pairs)).toEqual([
      { pr: 5, title: 'e', reason: 'conflicts', rebaseAfter: [4] },
      { pr: 4, title: 'd', reason: 'conflicts', rebaseAfter: [1] },
      { pr: 1, title: 'a', reason: 'clear', rebaseAfter: [] },
      { pr: 2, title: 'b', reason: 'after-base', rebaseAfter: [] },
      { pr: 3, title: 'c', reason: 'needs-rebase', rebaseAfter: [] },
    ]);
  });
});

describe('planRows', () => {
  it('says why each step sits where it does, naming what it forces to rebase', () => {
    expect(planRows(mergePlan(pulls, pairs)).map((r) => [r.step, r.pr, r.why, r.tone])).toEqual([
      [1, 5, 'lands first; forces a rebase of #4', 'hot'],
      [2, 4, 'lands first; forces a rebase of #1', 'hot'],
      [3, 1, 'touches nothing else waiting', 'ok'],
      [4, 2, 'its stacked base has landed', 'ok'],
      [5, 3, 'already conflicts with its base — rebase it', 'hot'],
    ]);
  });

  it('says how the pairs were checked', () => {
    expect(planHow('checked', 1)).toBe(
      '1 pair would conflict — git merged every pair that shares a file.',
    );
    expect(planHow('no-clone', 0)).toBe(
      'No checkout was available, so pairs that share files are shown unchecked.',
    );
  });
});
