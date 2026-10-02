import type { ArchitectureNode } from './architecture-types.ts';
import { isProjectModule, type PathAlias, resolveModule } from './module-resolution.ts';
import type { ScannedFile, ScannedImport } from './scanned-source.ts';

/** A node's id: its file and its name, so two classes of one name stay apart. */
export const nodeId = (file: string, name: string): string => `${file}#${name}`;

/** Turns a name, as one file sees it, into the node it means. */
export interface ReferenceResolver {
  /** The node `name` means in `file`; null when it is not a mapped node. */
  named(file: string, name: string): string | null;
  /** The node exported as `name` from `module`, as `file` imports it; null when it is not mapped. */
  exported(file: string, module: string, name: string): string | null;
  /** The scanned file `module` points at from `file`; null for a package. */
  module(file: string, module: string): string | null;
}

export interface ResolverInputs {
  readonly nodes: readonly ArchitectureNode[];
  readonly files: readonly ScannedFile[];
  readonly aliases: readonly PathAlias[];
}

function idsByName(nodes: readonly ArchitectureNode[]): Map<string, string[]> {
  const ids = new Map<string, string[]>();
  for (const { id, name } of nodes) ids.set(name, [...(ids.get(name) ?? []), id]);
  return ids;
}

/**
 * Resolves a name the way TypeScript would: declared in the file, else through
 * its import. A name the imports cannot place (a barrel, an alias outside the
 * app) falls back to the one node of that name, and to nothing when several share it.
 */
export function referenceResolver({ nodes, files, aliases }: ResolverInputs): ReferenceResolver {
  const ids = new Set(nodes.map(({ id }) => id));
  const byName = idsByName(nodes);
  const paths = new Set(files.map(({ file }) => file));
  const importsByFile = new Map(
    files.map(({ file, imports }) => [
      file,
      new Map(imports.map((entry): [string, ScannedImport] => [entry.local, entry])),
    ]),
  );
  const only = (name: string): string | null => {
    const found = byName.get(name) ?? [];
    return found.length === 1 ? (found[0] ?? null) : null;
  };
  const module = (file: string, spec: string): string | null =>
    resolveModule(file, spec, paths, aliases);
  const exported = (file: string, spec: string, name: string): string | null => {
    if (!isProjectModule(spec, aliases)) return null;
    const target = module(file, spec);
    const id = target === null ? null : nodeId(target, name);
    return id !== null && ids.has(id) ? id : only(name);
  };
  const named = (file: string, name: string): string | null => {
    const local = nodeId(file, name);
    if (ids.has(local)) return local;
    const imported = importsByFile.get(file)?.get(name);
    return imported ? exported(file, imported.module, imported.imported) : only(name);
  };
  return { named, exported, module };
}
