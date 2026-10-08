import { type AreaRule, placeOf } from './area-rules.ts';
import {
  type ArchitectureEdge,
  type ArchitectureMap,
  type ArchitectureNode,
  type ArchitectureRuntime,
  isCodeEdge,
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

/** The one runtime this scanner reads so far: the Angular app. */
const BROWSER: ArchitectureRuntime = {
  id: 'browser',
  label: 'Browser app',
  kind: 'browser',
  root: 'src/app',
};

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
        parent: null,
        members: [],
        endpoint: null,
        loc: 0,
        metrics: { fanIn: 0, fanOut: 0, churn: 0 },
        marks: [],
      });
    }
  }
  return [...nodes.values()];
}

/** Each node's code edges in and out, by its id. */
function fansOf(
  edges: readonly ArchitectureEdge[],
): (id: string) => Pick<ArchitectureNode['metrics'], 'fanIn' | 'fanOut'> {
  const code = edges.filter(isCodeEdge);
  const tally = (end: 'from' | 'to') => {
    const counts = new Map<string, number>();
    for (const edge of code) counts.set(edge[end], (counts.get(edge[end]) ?? 0) + 1);
    return counts;
  };
  const [ins, outs] = [tally('to'), tally('from')];
  return (id) => ({ fanIn: ins.get(id) ?? 0, fanOut: outs.get(id) ?? 0 });
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
  const fans = fansOf(edges);
  return {
    schema: MAP_SCHEMA,
    project: inputs.project,
    scannedAt: inputs.scannedAt,
    churnDays: 0,
    runtimes: [BROWSER],
    areas: inputs.rules.map(({ id, label, root }) => ({
      id,
      label,
      runtime: BROWSER.id,
      folder: root,
    })),
    windows: inputs.windows,
    nodes: unhosted.map((node) => ({
      ...node,
      windows: hosts.get(node.id) ?? [],
      metrics: { ...node.metrics, ...fans(node.id) },
    })),
    edges,
    cycles: [],
  };
}
