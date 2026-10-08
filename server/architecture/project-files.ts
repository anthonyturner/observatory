import { readFile, readdir, stat } from 'node:fs/promises';
import { join, posix } from 'node:path';
import ts from 'typescript';

/** The endings of files that are tests, declarations or test support, which the map leaves out. */
export const SKIPPED_SUFFIXES = ['.spec.ts', '.d.ts', '.testing.ts'];
const INSTALLED_PACKAGES = 'node_modules';

/** Whether a file is source the map reads: TypeScript that is not a test, a declaration or a package. */
export const isSource = (file: string): boolean =>
  file.endsWith('.ts') &&
  !SKIPPED_SUFFIXES.some((suffix) => file.endsWith(suffix)) &&
  !file.split(/[\/]/).includes(INSTALLED_PACKAGES);

export const isMissingFile = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

/** A file's text; null when it does not exist. */
export async function textOf(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A JSON file's value, which may carry comments as an Angular or TypeScript config may; undefined when it cannot be read. */
export function jsonIn(name: string, text: string): unknown {
  return ts.parseConfigFileTextToJson(name, text).config;
}

/** A project's JSON file read as an object; null when it is absent or holds anything else. */
export async function jsonObjectOf(
  projectRoot: string,
  name: string,
): Promise<Record<string, unknown> | null> {
  const text = await textOf(join(projectRoot, name));
  const value = text === null ? null : jsonIn(name, text);
  return isObject(value) ? value : null;
}

/** Whether `folder`, relative to the project root, exists as a folder. */
export async function isFolder(projectRoot: string, folder: string): Promise<boolean> {
  try {
    return (await stat(join(projectRoot, folder))).isDirectory();
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
}

/** Every source file under `folder`, by its path from the project root, sorted; none for a folder that is not there. */
export async function sourceFilesUnder(projectRoot: string, folder: string): Promise<string[]> {
  try {
    const names = await readdir(join(projectRoot, folder), { recursive: true });
    return names
      .filter(isSource)
      .map((name) => posix.join(folder, name.replaceAll('\\', '/')))
      .sort();
  } catch (error) {
    if (isMissingFile(error)) return [];
    throw error;
  }
}
