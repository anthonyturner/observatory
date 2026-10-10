import type { CloneFinder } from '../collisions/clone-finder.ts';
import { NotFound } from '../http/api-handler.ts';
import { keyedCache } from '../util/cached-by-key.ts';
import type { ArchitectureMap } from './architecture-types.ts';
import { scanProject } from './scan-project.ts';

/**
 * A scan reads every source file of a clone and takes seconds; a page that is
 * open for a while, and the full map opened from it, should not pay for it
 * twice. A Refresh asks sooner.
 */
const MAP_TTL_MS = 5 * 60_000;

/** Architecture maps by repository, scanned from the repository's local clone. */
export interface ArchitectureMaps {
  /** Throws NotFound when this machine holds no clone of `repo`. */
  read(repo: string): Promise<ArchitectureMap>;
  /** The next read of `repo` scans its clone again. */
  forget(repo: string): void;
}

export function architectureMaps(
  clones: CloneFinder,
  scan: typeof scanProject = scanProject,
  clock: () => number = Date.now,
): ArchitectureMaps {
  const maps = keyedCache(
    async (repo: string): Promise<ArchitectureMap> => {
      const folder = await clones.cloneOf(repo);
      if (folder === null) throw new NotFound(`No local clone of ${repo}.`);
      return scan(folder, { scannedAt: new Date(clock()).toISOString() });
    },
    MAP_TTL_MS,
    clock,
  );
  return { read: (repo) => maps.read(repo), forget: (repo) => maps.forget(repo) };
}
