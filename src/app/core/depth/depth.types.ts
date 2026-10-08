export const VERDICTS = ['deep', 'balanced', 'shallow'] as const;
export type Verdict = (typeof VERDICTS)[number];

/** One source file with something to call, as `GET /api/depth` measures it. */
export interface DepthModule {
  /** From the repository root, with forward slashes. */
  readonly file: string;
  /** The file's folder; '' at the root. */
  readonly folder: string;
  /** The work the file does, in statements. */
  readonly implementation: number;
  /** What a caller has to learn: exported names, their parameters and public members. */
  readonly interfaceSize: number;
  /** Implementation per thing a caller must learn. */
  readonly depth: number;
  readonly verdict: Verdict;
  /** The id of the design idea this verdict points at, one of the report's `principles`. */
  readonly principle: string;
}

/** A design idea a verdict points at, in words. */
export interface DepthPrinciple {
  readonly id: string;
  readonly title: string;
  readonly idea: string;
}

export interface DepthReport {
  readonly repo: string;
  /** Milliseconds since the epoch. */
  readonly scannedAt: number;
  readonly modules: readonly DepthModule[];
  readonly principles: readonly DepthPrinciple[];
}
