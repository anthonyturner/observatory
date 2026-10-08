import type { ModuleMeasure } from './module-measure.ts';

export const VERDICTS = ['deep', 'balanced', 'shallow'] as const;
export type Verdict = (typeof VERDICTS)[number];

/** The ids in `server/principles/principles.ts` that a verdict teaches. */
export type DepthPrincipleId = 'deep-modules' | 'shallow-modules';

/** A caller learns more than the module does for them. */
export const SHALLOW_BELOW = 1;
/** The module does at least this many times what its callers have to learn. */
export const DEEP_FROM = 8;
/** An interface this small has too little to be shallow: nothing to wrap. */
const SMALLEST_SHALLOW_INTERFACE = 2;

const PRINCIPLE_OF: Readonly<Record<Verdict, DepthPrincipleId>> = {
  deep: 'deep-modules',
  balanced: 'deep-modules',
  shallow: 'shallow-modules',
};

const DECIMALS = 100;

export interface DepthJudgement {
  /** Work done per thing a caller must learn. */
  readonly depth: number;
  readonly verdict: Verdict;
  readonly principle: DepthPrincipleId;
}

function verdictOf(depth: number, interfaceSize: number): Verdict {
  if (depth >= DEEP_FROM) return 'deep';
  const isShallow = depth < SHALLOW_BELOW && interfaceSize >= SMALLEST_SHALLOW_INTERFACE;
  return isShallow ? 'shallow' : 'balanced';
}

/** Depth is implementation over interface; an empty interface counts as one thing to learn. */
export function judgeDepth({ implementation, interfaceSize }: ModuleMeasure): DepthJudgement {
  const raw = implementation / Math.max(interfaceSize, 1);
  const verdict = verdictOf(raw, interfaceSize);
  return {
    depth: Math.round(raw * DECIMALS) / DECIMALS,
    verdict,
    principle: PRINCIPLE_OF[verdict],
  };
}
