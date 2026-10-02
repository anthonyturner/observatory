import { type AreaRule, placeOf } from './area-rules.ts';
import {
  type ArchitectureMap,
  type ArchitectureNode,
  MAP_SCHEMA,
  type NodeKind,
} from './architecture-types.ts';
import { edgesOf } from './map-edges.ts';
import type { PathAlias } from './module-resolution.ts';
import { nodeId, referenceResolver } from './reference-resolver.ts';
import type { DeclarationSort, ScannedDeclaration, ScannedFile } from './scanned-source.ts';
import { windowsByNode } from './window-hosting.ts';

export interface MapInputs {
  readonly project: string;
  readonly scannedAt: string;
  readonly windows: readonly string[];
  readonly rules: readonly AreaRule[];
  readonly files: readonly ScannedFile[];
  readonly aliases: readonly PathAlias[];
}

const HANDLER_NAME = /Handler/;
const STORE_NAME = /Store/;

/** The kind of every sort but `Injectable`, whose kind its name decides. */
const KIND_OF_SORT: Readonly<Record<Exclude<DeclarationSort, 'Injectable'>, NodeKind>> = {
  Component: 'component',
  Directive: 'component',
  Pipe: 'component',
  InjectionToken: 'token',
  function: 'function',
  providers: 'providers',
};

function kindOf({ sort, name }: ScannedDeclaration): NodeKind {
  if (sort !== 'Injectable') return KIND_OF_SORT[sort];
  if (HANDLER_NAME.test(name)) return 'handler';
  return STORE_NAME.test(name) ? 'store' : 'service';
}

/** One node per declaration in a file some rule places; a name repeated in one file keeps its first. */
function nodesOf({ files, rules }: MapInputs): ArchitectureNode[] {
  const nodes = new Map<string, ArchitectureNode>();
  for (const { file, declarations } of files) {
    const place = placeOf(file, rules);
    if (!place) continue;
    for (const declaration of declarations) {
      const id = nodeId(file, declaration.name);
      if (nodes.has(id)) continue;
      const { name, providedIn } = declaration;
      nodes.set(id, {
        id,
        name,
        kind: kindOf(declaration),
        file,
        ...place,
        providedIn,
        windows: [],
      });
    }
  }
  return [...nodes.values()];
}

/** The map of a scanned project: its declarations as nodes, and each dependency between two of them. */
export function architectureMap(inputs: MapInputs): ArchitectureMap {
  const unhosted = nodesOf(inputs);
  const resolver = referenceResolver({
    nodes: unhosted,
    files: inputs.files,
    aliases: inputs.aliases,
  });
  const ids = new Set(unhosted.map(({ id }) => id));
  const edges = edgesOf({ files: inputs.files, ids, resolver });
  const hosts = windowsByNode({ windows: inputs.windows, files: inputs.files, edges, resolver });
  return {
    schema: MAP_SCHEMA,
    project: inputs.project,
    scannedAt: inputs.scannedAt,
    areas: inputs.rules.map(({ id, label }) => ({ id, label })),
    windows: inputs.windows,
    nodes: unhosted.map((node) => ({ ...node, windows: hosts.get(node.id) ?? [] })),
    edges,
  };
}
