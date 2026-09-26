import { SkyPair } from './engine/collision-layer';

/** What the plan needs to know about each open pull request. */
export interface PlanPull {
  readonly number: number;
  readonly title: string;
  /** Its head branch, and the branch it merges into. */
  readonly head: string;
  readonly base: string;
  /** GitHub's word on whether it merges into its base: CONFLICTING goes last. */
  readonly mergeable: string;
  readonly additions: number | null;
  readonly deletions: number | null;
}

/** Why a pull request sits where it does in the plan. */
export type PlanReason = 'clear' | 'after-base' | 'conflicts' | 'needs-rebase';

export interface PlanStep {
  readonly pr: number;
  readonly title: string;
  readonly reason: PlanReason;
  /** What landing it forces to rebase. */
  readonly rebaseAfter: readonly number[];
}

/**
 * pr-starmap's merge plan: an order that needs the fewest rebases. Greedy on
 * the conflict graph: of the pull requests free to land (their stacked base
 * already landed, their own branch merging cleanly), take the one that
 * conflicts with the fewest still waiting, then the fewest unchecked overlaps,
 * then the smallest. Whatever it conflicts with must rebase once it lands.
 * Branches that already cannot merge into their base go last.
 */
export function mergePlan(pulls: readonly PlanPull[], pairs: readonly SkyPair[]): PlanStep[] {
  const byNumber = new Map(pulls.map((p) => [p.number, p]));
  const byHead = new Map(pulls.map((p) => [p.head, p.number]));
  const hard = new Map(pulls.map((p) => [p.number, new Set<number>()]));
  const soft = new Map(pulls.map((p) => [p.number, 0]));
  for (const p of pairs) {
    if (p.conflict === true) {
      hard.get(p.a)?.add(p.b);
      hard.get(p.b)?.add(p.a);
    } else if (p.conflict === null) {
      if (soft.has(p.a)) soft.set(p.a, (soft.get(p.a) ?? 0) + 1);
      if (soft.has(p.b)) soft.set(p.b, (soft.get(p.b) ?? 0) + 1);
    }
  }
  const pull = (n: number): PlanPull => byNumber.get(n) as PlanPull;
  const size = (n: number): number => (pull(n).additions ?? 0) + (pull(n).deletions ?? 0);
  const waiting = new Set(pulls.map((p) => p.number));
  const landed = new Set<number>();
  const steps: PlanStep[] = [];
  const stackedOn = (n: number): number | undefined => byHead.get(pull(n).base);
  const live = (n: number): number => [...(hard.get(n) ?? [])].filter((m) => waiting.has(m)).length;

  while (waiting.size) {
    const free = [...waiting].filter((n) => {
      const base = stackedOn(n);
      return !(base !== undefined && waiting.has(base));
    });
    const clean = free.filter((n) => pull(n).mergeable !== 'CONFLICTING');
    const pool = clean.length ? clean : free.length ? free : [...waiting];
    pool.sort(
      (x, y) =>
        live(x) - live(y) || (soft.get(x) ?? 0) - (soft.get(y) ?? 0) || size(x) - size(y) || x - y,
    );
    const n = pool[0];
    waiting.delete(n);
    landed.add(n);
    const rebase = [...(hard.get(n) ?? [])].filter((m) => waiting.has(m));
    const stacked = stackedOn(n);
    steps.push({
      pr: n,
      title: pull(n).title,
      reason:
        pull(n).mergeable === 'CONFLICTING'
          ? 'needs-rebase'
          : stacked !== undefined && landed.has(stacked)
            ? 'after-base'
            : rebase.length
              ? 'conflicts'
              : 'clear',
      rebaseAfter: rebase,
    });
  }
  return steps;
}
