import {
  type ArchitectureEdge,
  type ArchitectureMap,
  type ArchitectureNode,
  type ArchitectureRuntime,
  MAP_SCHEMA,
  RUNTIME_KINDS,
} from './architecture-types.ts';
import { entryIdsOf } from './entry-points.ts';
import { importLinks } from './import-links.ts';
import type { ImportGraph } from './import-graph.ts';
import { analyse } from './map-analysis.ts';
import { edgesOf, parentsOf, templateUses } from './map-edges.ts';
import { fileNodes, placementsOf } from './map-nodes.ts';
import type { PathAlias } from './module-resolution.ts';
import { networkLinks } from './network-links.ts';
import { referenceResolver } from './reference-resolver.ts';
import type { ScannedFile } from './scanned-source.ts';
import { byText } from './sort-order.ts';
import { windowsByNode } from './window-hosting.ts';

export interface MapInputs {
  readonly project: string;
  readonly scannedAt: string;
  readonly windows: readonly string[];
  /** The runtimes found inside the project; the outside ones are worked out from what is reached. */
  readonly runtimes: readonly ArchitectureRuntime[];
  /** Files nothing imports because something else runs them. */
  readonly entryFiles: readonly string[];
  /** Every scanned file, including entry files outside any runtime's folder. */
  readonly files: readonly ScannedFile[];
  readonly aliases: readonly PathAlias[];
  readonly graph: ImportGraph;
  /** Commits to each file within the last `churnDays` days. */
  readonly churn: ReadonlyMap<string, number>;
  readonly churnDays: number;
}

const edgeOrder = (a: ArchitectureEdge, b: ArchitectureEdge): number =>
  byText(a.from, b.from) || byText(a.to, b.to) || byText(a.kind, b.kind);

const runtimeOrder = (a: ArchitectureRuntime, b: ArchitectureRuntime): number =>
  RUNTIME_KINDS.indexOf(a.kind) - RUNTIME_KINDS.indexOf(b.kind);

/**
 * The map of a scanned project, as plain data, worked out from the scanned
 * files alone, so the same files give the same map. Lists are sorted, so the
 * one thing a rescan of an unchanged project changes is `scannedAt`.
 */
export function architectureMap(inputs: MapInputs): ArchitectureMap {
  const { files, aliases } = inputs;
  const { placements, areas: inProjectAreas } = placementsOf(inputs.runtimes, files);
  const context = {
    placements,
    churn: inputs.churn,
    cycleFiles: new Set(inputs.graph.cycles.flat()),
  };
  const nodesByFile = fileNodes(files, context);
  const nodes = [...nodesByFile.values()].flat();

  // Only Angular declarations take part in injection and template links, so the
  // resolver does not see module nodes, whose names could shadow a class's.
  const declared = nodes.filter(({ kind }) => kind !== 'module');
  const resolver = referenceResolver({ nodes: declared, files, aliases });
  const ids = new Set(declared.map(({ id }) => id));
  const links = edgesOf({ files, ids, resolver });
  const hosts = windowsByNode({ windows: inputs.windows, files, edges: links, resolver });
  const parents = parentsOf(templateUses(files, ids));

  const network = networkLinks({ files, nodesByFile, context, aliases });
  const imports = importLinks(inputs.graph, nodesByFile, [...links, ...network.edges]);

  const runtimes = [...inputs.runtimes, ...network.runtimes].sort(runtimeOrder);
  const areas = [...inProjectAreas, ...network.areas];
  const analysed = analyse({
    nodes: [...nodes, ...network.nodes].map((node) => ({
      ...node,
      windows: [...(hosts.get(node.id) ?? [])].sort(byText),
      parent: parents.get(node.id) ?? null,
    })),
    edges: [...links, ...network.edges, ...imports.edges],
    entryIds: entryIdsOf(files, inputs.entryFiles, nodesByFile, resolver),
    runtimeOfArea: new Map(areas.map(({ id, runtime }) => [id, runtime])),
    cycleFilePairs: imports.cycleFilePairs,
    cycleIds: new Set(imports.cycles.flat()),
  });

  const usedAreas = new Set(analysed.nodes.map(({ area }) => area));
  return {
    schema: MAP_SCHEMA,
    project: inputs.project,
    scannedAt: inputs.scannedAt,
    churnDays: inputs.churnDays,
    runtimes,
    areas: areas.filter(({ id }) => usedAreas.has(id)).sort((a, b) => byText(a.id, b.id)),
    windows: [...inputs.windows].sort(byText),
    nodes: analysed.nodes.sort((a, b) => byText(a.id, b.id)),
    edges: analysed.edges.sort(edgeOrder),
    cycles: imports.cycles,
  };
}
