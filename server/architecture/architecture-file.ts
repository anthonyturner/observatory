import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { OBSERVATORY_DIR } from '../store/file-store.ts';
import type { ArchitectureMap } from './architecture-types.ts';

/**
 * Where the command-line scans write by default. Kept outside the checkout:
 * the mapped project may be private, and a map names its every class and file,
 * so no commit here may carry one.
 */
export const ARCHITECTURE_FILE = join(OBSERVATORY_DIR, 'architecture', 'map.json');

export async function writeArchitecture(
  map: ArchitectureMap,
  file = ARCHITECTURE_FILE,
): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(map, null, 1));
}
