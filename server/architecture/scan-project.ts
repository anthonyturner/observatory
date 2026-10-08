import { basename, resolve } from 'node:path';
import { architectureMap } from './architecture-map.ts';
import type { ArchitectureMap } from './architecture-types.ts';
import { gitChurn } from './git-churn.ts';
import { importGraphOf } from './import-graph.ts';
import { manifestWindows, projectAliases, scannedFiles } from './project-source.ts';
import { detectLayout, type LayoutOptions } from './project-layout.ts';

/** How many days of history before HEAD `churn` counts, when a scan does not say. */
const DEFAULT_CHURN_DAYS = 90;

export interface ScanOptions extends LayoutOptions {
  readonly churnDays?: number;
  /** When the scan happened, as an ISO date; now when left out. */
  readonly scannedAt?: string;
}

/**
 * Reads the project in `root` and maps it. The project is only read: nothing
 * in it is written, and no map is saved; the caller decides where one goes.
 */
export async function scanProject(
  root: string,
  options: ScanOptions = {},
): Promise<ArchitectureMap> {
  const projectRoot = resolve(root);
  const layout = await detectLayout(projectRoot, options);
  const files = await scannedFiles(
    projectRoot,
    layout.runtimes.map(({ root: folder }) => folder),
    layout.entryFiles,
  );
  const aliases = await projectAliases(projectRoot);
  const churn = await gitChurn(projectRoot, options.churnDays ?? DEFAULT_CHURN_DAYS);
  return architectureMap({
    project: basename(projectRoot),
    scannedAt: options.scannedAt ?? new Date().toISOString(),
    windows: await manifestWindows(projectRoot),
    runtimes: layout.runtimes,
    entryFiles: layout.entryFiles,
    files,
    aliases,
    graph: importGraphOf(files, aliases),
    churn: churn.commitsByFile,
    churnDays: churn.days,
  });
}
