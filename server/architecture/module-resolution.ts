import { posix } from 'node:path';

/** A `tsconfig.json` path alias: an import starting with `prefix` points under `target`. */
export interface PathAlias {
  readonly prefix: string;
  /** Relative to the project root, with forward slashes. */
  readonly target: string;
}

/** The order TypeScript tries a module path in: a file, a folder's index, then the path itself. */
const CANDIDATE_SUFFIXES = ['.ts', '/index.ts', ''];

/** The alias with the longest prefix `module` starts with, as TypeScript picks; null for none. */
function aliasFor(module: string, aliases: readonly PathAlias[]): PathAlias | null {
  return aliases
    .filter(({ prefix }) => module.startsWith(prefix))
    .reduce<PathAlias | null>(
      (best, alias) => (best && best.prefix.length >= alias.prefix.length ? best : alias),
      null,
    );
}

/** Whether `module` is one of the project's own files rather than a package. */
export const isProjectModule = (module: string, aliases: readonly PathAlias[]): boolean =>
  module.startsWith('.') || aliasFor(module, aliases) !== null;

function projectPathOf(
  fromFile: string,
  module: string,
  aliases: readonly PathAlias[],
): string | null {
  if (module.startsWith('.')) return posix.join(posix.dirname(fromFile), module);
  const alias = aliasFor(module, aliases);
  return alias ? posix.join(alias.target, module.slice(alias.prefix.length)) : null;
}

/** The scanned file `module`, imported from `fromFile`, points at; null for a package or an unscanned file. */
export function resolveModule(
  fromFile: string,
  module: string,
  files: ReadonlySet<string>,
  aliases: readonly PathAlias[],
): string | null {
  const projectPath = projectPathOf(fromFile, module, aliases);
  if (projectPath === null) return null;
  return (
    CANDIDATE_SUFFIXES.map((suffix) => `${projectPath}${suffix}`).find((path) => files.has(path)) ??
    null
  );
}
