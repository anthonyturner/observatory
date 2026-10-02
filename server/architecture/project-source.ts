import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScannedFile } from './architecture-map.ts';
import { scanSource } from './source-scan.ts';

const APP_FOLDER = join('src', 'app');
const MANIFEST_FILE = 'manifest.json';
const SKIPPED_SUFFIXES = ['.spec.ts', '.d.ts', '.testing.ts'];

const isSource = (file: string): boolean =>
  file.endsWith('.ts') && !SKIPPED_SUFFIXES.some((suffix) => file.endsWith(suffix));

export const isMissingFile = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

/** Every source file under the project's `src/app`, scanned; nothing in the project is written. */
export async function scannedFiles(projectRoot: string): Promise<ScannedFile[]> {
  const appRoot = join(projectRoot, APP_FOLDER);
  const names = (await readdir(appRoot, { recursive: true })).filter(isSource).sort();
  return Promise.all(
    names.map(async (name) => {
      const file = name.replaceAll('\\', '/');
      return { file, classes: scanSource(file, await readFile(join(appRoot, name), 'utf8')) };
    }),
  );
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The window names in an Overwolf manifest's text; none when it declares no windows. */
export function windowsIn(manifestText: string): string[] {
  const manifest: unknown = JSON.parse(manifestText);
  const data = isObject(manifest) ? manifest['data'] : null;
  const windows = isObject(data) ? data['windows'] : null;
  return isObject(windows) ? Object.keys(windows) : [];
}

/** The project's Overwolf windows; none for a project with no manifest. */
export async function manifestWindows(projectRoot: string): Promise<string[]> {
  try {
    return windowsIn(await readFile(join(projectRoot, MANIFEST_FILE), 'utf8'));
  } catch (error) {
    if (isMissingFile(error)) return [];
    throw error;
  }
}
