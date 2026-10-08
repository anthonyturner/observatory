import type { ArchitectureNode } from './architecture-types.ts';
import type { ReferenceResolver } from './reference-resolver.ts';
import { componentOf, placedRoutes } from './routed-components.ts';
import type { ScannedFile } from './scanned-source.ts';

/**
 * The nodes something starts without an edge to them, which are therefore not
 * unused however little depends on them: those a route shows, those the app
 * is bootstrapped with, and every node in a file that is run directly, such
 * as the API's `main.ts` or a script a `package.json` names.
 */
export function entryIdsOf(
  files: readonly ScannedFile[],
  entryFiles: readonly string[],
  nodesByFile: ReadonlyMap<string, readonly ArchitectureNode[]>,
  resolver: ReferenceResolver,
): Set<string> {
  return new Set([
    ...placedRoutes(files).flatMap((placed) => componentOf(placed, resolver)),
    ...files.flatMap(({ file, bootstrapped }) =>
      bootstrapped.flatMap((name) => resolver.named(file, name) ?? []),
    ),
    ...entryFiles.flatMap((file) => (nodesByFile.get(file) ?? []).map(({ id }) => id)),
  ]);
}
