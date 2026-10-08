import { type PathAlias, resolveModule } from './module-resolution.ts';
import type { ScannedFile } from './scanned-source.ts';
import { type TextPart, UNKNOWN_TEXT } from './text-parts.ts';

/** The text `parts` build when read in `file`, with every value that cannot be known left as UNKNOWN_TEXT. */
export type TextResolver = (file: string, parts: readonly TextPart[]) => string;

/** A constant that names another, such as `A = B`, may chain; more links than this is a loop. */
const MAX_CONSTANT_CHAIN = 8;

interface Scope {
  readonly constants: ReadonlyMap<string, readonly TextPart[]>;
  readonly imports: ReadonlyMap<string, { readonly module: string; readonly imported: string }>;
}

/** Looks constants up the way TypeScript would: declared in the file, else through its import. */
export function textResolver(
  files: readonly ScannedFile[],
  aliases: readonly PathAlias[],
): TextResolver {
  const paths = new Set(files.map(({ file }) => file));
  const scopes = new Map<string, Scope>(
    files.map(({ file, constants, imports }) => [
      file,
      {
        constants: new Map(constants.map(({ name, parts }) => [name, parts])),
        imports: new Map(
          imports.map(({ local, imported, module }) => [local, { imported, module }]),
        ),
      },
    ]),
  );

  const resolve = (file: string, parts: readonly TextPart[], links: number): string =>
    parts.map((part) => (typeof part === 'string' ? part : named(file, part.name, links))).join('');

  const named = (file: string, name: string | null, links: number): string => {
    if (name === null || links <= 0) return UNKNOWN_TEXT;
    const scope = scopes.get(file);
    const local = scope?.constants.get(name);
    if (local) return resolve(file, local, links - 1);
    const imported = scope?.imports.get(name);
    const target = imported ? resolveModule(file, imported.module, paths, aliases) : null;
    const constant =
      target && imported ? scopes.get(target)?.constants.get(imported.imported) : null;
    return target && constant ? resolve(target, constant, links - 1) : UNKNOWN_TEXT;
  };

  return (file, parts) => resolve(file, parts, MAX_CONSTANT_CHAIN);
}
