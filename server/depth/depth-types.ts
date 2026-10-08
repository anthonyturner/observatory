import type { DepthJudgement } from './depth-verdict.ts';
import type { ModuleMeasure } from './module-measure.ts';

/** One source file with something to call, as the Depth screen draws it. */
export interface DepthModule extends ModuleMeasure, DepthJudgement {
  /** From the repository root, with forward slashes. */
  readonly file: string;
  /** The file's folder; '' at the root. */
  readonly folder: string;
}

/** A design idea a verdict points at: its id is `server/principles/principles.ts`'s. */
export interface DepthPrinciple {
  readonly id: string;
  readonly title: string;
  readonly idea: string;
}

/** The modules of one repository's local clone, and the ideas their verdicts name. */
export interface DepthReport {
  readonly repo: string;
  readonly scannedAt: string;
  readonly modules: readonly DepthModule[];
  readonly principles: readonly DepthPrinciple[];
}
