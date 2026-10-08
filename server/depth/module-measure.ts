import ts from 'typescript';
import { implementationSize } from './implementation-size.ts';
import { exportedSurface } from './interface-size.ts';

/** The two sizes depth is the ratio of. */
export interface ModuleMeasure {
  /** The work the file does: see `implementationSize`. */
  readonly implementation: number;
  /** What a caller has to learn to use it: see `exportedSurface`. */
  readonly interfaceSize: number;
}

/**
 * What a TypeScript file hides and what it shows. Null for a file that is not a
 * module in this sense: one that exports nothing is an entry point nothing
 * calls, and one that exports only types does no work and hides none.
 */
export function measureModule(fileName: string, text: string): ModuleMeasure | null {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const surface = exportedSurface(source);
  if (!surface.hasValue) return null;
  return { implementation: implementationSize(source), interfaceSize: surface.size };
}
