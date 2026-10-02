import { type AreaRule, placeOf } from './area-rules.ts';
import type {
  ArchitectureEdge,
  ArchitectureMap,
  ArchitectureNode,
  NodeKind,
} from './architecture-types.ts';
import type { ScannedClass } from './source-scan.ts';

/** One source file, by its path relative to `src/app`, and the classes it declares. */
export interface ScannedFile {
  readonly file: string;
  readonly classes: readonly ScannedClass[];
}

export interface MapInputs {
  readonly project: string;
  readonly scannedAt: string;
  readonly windows: readonly string[];
  readonly rules: readonly AreaRule[];
  readonly files: readonly ScannedFile[];
}

const HANDLER_NAME = /Handler/;
const STORE_NAME = /Store/;

function kindOf(scanned: ScannedClass): NodeKind {
  if (scanned.decorator !== 'Injectable') return 'component';
  if (HANDLER_NAME.test(scanned.name)) return 'handler';
  return STORE_NAME.test(scanned.name) ? 'store' : 'service';
}

/** One node per class name; a second class of the same name is dropped, the first one kept. */
function nodesOf({ files, rules }: MapInputs): Map<string, ArchitectureNode> {
  const nodes = new Map<string, ArchitectureNode>();
  for (const { file, classes } of files) {
    const place = placeOf(file, rules);
    if (!place) continue;
    for (const scanned of classes) {
      if (nodes.has(scanned.name)) continue;
      const { name, providedIn } = scanned;
      nodes.set(name, { name, kind: kindOf(scanned), file, ...place, providedIn });
    }
  }
  return nodes;
}

/** A class's edges to other mapped classes, one per target however often it is injected. */
function edgesFrom(scanned: ScannedClass, known: ReadonlySet<string>): ArchitectureEdge[] {
  const edges = new Map<string, ArchitectureEdge>();
  for (const { target, how, members } of scanned.injections) {
    if (!known.has(target) || target === scanned.name) continue;
    const earlier = edges.get(target);
    const merged = [...new Set([...(earlier?.members ?? []), ...members])].sort();
    edges.set(target, {
      from: scanned.name,
      to: target,
      how: earlier?.how ?? how,
      members: merged,
    });
  }
  return [...edges.values()];
}

/** The map of a scanned project: its classes as nodes, and each injection between two of them. */
export function architectureMap(inputs: MapInputs): ArchitectureMap {
  const nodes = nodesOf(inputs);
  const known = new Set(nodes.keys());
  const edges = inputs.files.flatMap(({ file, classes }) =>
    classes
      .filter((scanned) => nodes.get(scanned.name)?.file === file)
      .flatMap((scanned) => edgesFrom(scanned, known)),
  );
  return {
    project: inputs.project,
    scannedAt: inputs.scannedAt,
    areas: inputs.rules.map(({ id, label }) => ({ id, label })),
    windows: inputs.windows,
    nodes: [...nodes.values()],
    edges,
  };
}
