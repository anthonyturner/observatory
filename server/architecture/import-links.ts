import type { ArchitectureEdge, ArchitectureNode } from './architecture-types.ts';
import type { ImportGraph } from './import-graph.ts';

/** Imports between files, in the terms of the map's nodes. */
export interface ImportLinks {
  /** An `imports` edge for each import no other edge explains. */
  readonly edges: ArchitectureEdge[];
  /** Each import cycle as the ids of its nodes, in order. */
  readonly cycles: string[][];
  /** The pairs of files, `<importer>><imported>`, that one of the cycles runs through. */
  readonly cycleFilePairs: ReadonlySet<string>;
}

export const filePair = (from: string, to: string): string => `${from}>${to}`;

/**
 * Turns the file import graph into links between nodes.
 *
 * A file's nodes share its imports, so an import joins the first node of the
 * importing file to the first node of the imported one. It gets an `imports`
 * edge only when no edge in `existing` already joins any node of the importing
 * file to any node of the imported one: an injection or a template use says
 * more than an import, and one of those explains the import.
 *
 * A cycle is listed when every file on it holds a node, by the first node of
 * each. One through a file the map does not hold would name nodes with no edge
 * between them.
 */
export function importLinks(
  graph: ImportGraph,
  nodesByFile: ReadonlyMap<string, readonly ArchitectureNode[]>,
  existing: readonly ArchitectureEdge[],
): ImportLinks {
  const fileOf = new Map(
    [...nodesByFile].flatMap(([file, nodes]) =>
      nodes.map(({ id }): [string, string] => [id, file]),
    ),
  );
  const explained = new Set(
    existing.flatMap(({ from, to }) => {
      const [fromFile, toFile] = [fileOf.get(from), fileOf.get(to)];
      return fromFile !== undefined && toFile !== undefined ? [filePair(fromFile, toFile)] : [];
    }),
  );
  const firstId = (file: string): string | undefined => nodesByFile.get(file)?.[0]?.id;

  const edges = graph.imports.flatMap(({ from, to }): ArchitectureEdge[] => {
    const [fromId, toId] = [firstId(from), firstId(to)];
    if (fromId === undefined || toId === undefined || explained.has(filePair(from, to))) return [];
    return [{ from: fromId, to: toId, kind: 'imports', how: null, members: [], marks: [] }];
  });

  const held = graph.cycles.filter((cycle) => cycle.every((file) => firstId(file) !== undefined));
  return {
    edges,
    cycles: held.map((cycle) => cycle.flatMap((file) => firstId(file) ?? [])),
    cycleFilePairs: new Set(
      held.flatMap((cycle) =>
        cycle.map((file, at) => filePair(file, cycle[(at + 1) % cycle.length] ?? file)),
      ),
    ),
  };
}
