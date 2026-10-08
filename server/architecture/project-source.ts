import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import ts from 'typescript';
import type { PathAlias } from './module-resolution.ts';
import type { ScannedDeclaration, ScannedFile } from './scanned-source.ts';
import { scanSource } from './source-scan.ts';
import { tagsIn } from './template-tags.ts';

/** Where an Angular app's source lives, relative to the project root. */
const APP_FOLDER = 'src/app';
const MANIFEST_FILE = 'manifest.json';
const TSCONFIG_FILE = 'tsconfig.json';
const WILDCARD = '*';
const SKIPPED_SUFFIXES = ['.spec.ts', '.d.ts', '.testing.ts'];

/** Whether a path is production TypeScript: not a spec, a declaration file or a test helper. */
export const isSource = (file: string): boolean =>
  file.endsWith('.ts') && !SKIPPED_SUFFIXES.some((suffix) => file.endsWith(suffix));

export const isMissingFile = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

/** A file's text; null when it does not exist. */
async function textOf(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

/** The declaration with the tags of its `templateUrl` added; unchanged when it has none. */
async function withTemplate(
  declaration: ScannedDeclaration,
  folder: string,
): Promise<ScannedDeclaration> {
  if (declaration.templateUrl === null) return declaration;
  const template = await textOf(join(folder, declaration.templateUrl));
  if (template === null) return declaration;
  return { ...declaration, tags: [...new Set([...declaration.tags, ...tagsIn(template)])] };
}

/** Every source file under the project's `src/app`, scanned, by its path from the project root; nothing in the project is written. */
export async function scannedFiles(projectRoot: string): Promise<ScannedFile[]> {
  const appRoot = join(projectRoot, APP_FOLDER);
  const names = (await readdir(appRoot, { recursive: true })).filter(isSource).sort();
  return Promise.all(
    names.map(async (name) => {
      const file = posix.join(APP_FOLDER, name.replaceAll('\\', '/'));
      const scanned = scanSource(file, await readFile(join(appRoot, name), 'utf8'));
      const folder = dirname(join(appRoot, name));
      const declarations = await Promise.all(
        scanned.declarations.map((declaration) => withTemplate(declaration, folder)),
      );
      return { ...scanned, file, declarations };
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
  const text = await textOf(join(projectRoot, MANIFEST_FILE));
  return text === null ? [] : windowsIn(text);
}

/** `"@app/*": ["./src/app/*"]` as an alias; null for an exact path or one with no target. */
function aliasOf(pattern: string, targets: unknown, baseUrl: string): PathAlias | null {
  const [target] = Array.isArray(targets) ? targets : [];
  if (!pattern.endsWith(WILDCARD) || typeof target !== 'string' || !target.endsWith(WILDCARD)) {
    return null;
  }
  return { prefix: pattern.slice(0, -1), target: posix.join(baseUrl, target.slice(0, -1)) };
}

/** The wildcard path aliases in a `tsconfig.json`'s text, which may carry comments. */
export function aliasesIn(tsconfigText: string): PathAlias[] {
  const { config }: { config?: unknown } = ts.parseConfigFileTextToJson(
    TSCONFIG_FILE,
    tsconfigText,
  );
  const options = isObject(config) ? config['compilerOptions'] : null;
  const paths = isObject(options) ? options['paths'] : null;
  if (!isObject(options) || !isObject(paths)) return [];
  const baseUrl = typeof options['baseUrl'] === 'string' ? options['baseUrl'] : '.';
  return Object.entries(paths).flatMap(
    ([pattern, targets]) => aliasOf(pattern, targets, baseUrl) ?? [],
  );
}

/** The project's import aliases; none for a project with no `tsconfig.json`. */
export async function projectAliases(projectRoot: string): Promise<PathAlias[]> {
  const text = await textOf(join(projectRoot, TSCONFIG_FILE));
  return text === null ? [] : aliasesIn(text);
}
