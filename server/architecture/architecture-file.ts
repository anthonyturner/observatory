import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { NotFound } from '../http/api-handler.ts';
import { OBSERVATORY_DIR } from '../store/file-store.ts';
import type { ArchitectureMap } from './architecture-types.ts';
import { isMissingFile } from './project-files.ts';

/**
 * Kept outside the checkout: the mapped project may be private, and a map
 * names its every class and file, so no commit here may carry one.
 */
export const ARCHITECTURE_FILE = join(OBSERVATORY_DIR, 'architecture', 'map.json');

export async function writeArchitecture(
  map: ArchitectureMap,
  file = ARCHITECTURE_FILE,
): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(map, null, 1));
}

/** Reads the map as the scanner last wrote it; the page checks its shape. */
export function fileArchitecture(file = ARCHITECTURE_FILE): () => Promise<unknown> {
  return async () => {
    try {
      return JSON.parse(await readFile(file, 'utf8')) as unknown;
    } catch (error) {
      if (isMissingFile(error)) throw new NotFound('No architecture map yet.');
      throw error;
    }
  };
}
