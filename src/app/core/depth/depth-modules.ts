import { DepthModule, Verdict } from './depth.types';

/** What narrows the modules shown: words their path must contain, and a verdict they must have. */
export interface DepthFilter {
  readonly query: string;
  readonly verdict: Verdict | null;
}

/** Modules whose path holds every word of the query, in any case, and that have the verdict if one is asked for. */
export function modulesMatching(
  modules: readonly DepthModule[],
  { query, verdict }: DepthFilter,
): DepthModule[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return modules.filter(
    ({ file, verdict: own }) =>
      (verdict === null || own === verdict) &&
      words.every((word) => file.toLowerCase().includes(word)),
  );
}

export function verdictCounts(modules: readonly DepthModule[]): Record<Verdict, number> {
  const counts: Record<Verdict, number> = { deep: 0, balanced: 0, shallow: 0 };
  for (const { verdict } of modules) counts[verdict]++;
  return counts;
}

/** Least deep first, the biggest interface first among equals: where a redesign pays most. */
export function shallowestFirst(modules: readonly DepthModule[]): DepthModule[] {
  return [...modules].sort(
    (a, b) =>
      a.depth - b.depth || b.interfaceSize - a.interfaceSize || a.file.localeCompare(b.file),
  );
}
