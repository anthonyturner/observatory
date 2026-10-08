import { readFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import ts from 'typescript';
import type { PathAlias } from './module-resolution.ts';
import { isObject, sourceFilesUnder, textOf } from './project-files.ts';
import type { ScannedDeclaration, ScannedFile } from './scanned-source.ts';
import { scanSource } from './source-scan.ts';
import { tagsIn } from './template-tags.ts';

const MANIFEST_FILE = 'manifest.json';
const TSCONFIG_FILE = 'tsconfig.json';
const WILDCARD = '*';

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

/**
 * The given files and every source file under the given folders, scanned, by
 * path from the project root. Nothing in the project is written.
 */
export async function scannedFiles(
  projectRoot: string,
  folders: readonly string[],
  files: readonly string[] = [],
): Promise<ScannedFile[]> {
  const found = await Promise.all(folders.map((folder) => sourceFilesUnder(projectRoot, folder)));
  const paths = [...new Set([...found.flat(), ...files])].sort();
  const scanned = await Promise.all(
    paths.map(async (file): Promise<ScannedFile | null> => {
      const text = await textOf(join(projectRoot, file));
      if (text === null) return null;
      const source = scanSource(file, text);
      const declarations = await Promise.all(
        source.declarations.map((declaration) =>
          withTemplate(declaration, dirname(join(projectRoot, file))),
        ),
      );
      return { ...source, file, declarations };
    }),
  );
  return scanned.flatMap((each) => each ?? []);
}

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
