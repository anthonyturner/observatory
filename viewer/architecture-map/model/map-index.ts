import type {
  ArchitectureArea,
  ArchitectureEdge,
  ArchitectureMap,
  ArchitectureNode,
  ArchitectureRuntime,
} from '../../../server/architecture/architecture-types.ts';

/**
 * A map with every lookup a view needs worked out once.
 *
 * A node with a `parent` is drawn inside its topmost ancestor's chip, so it has no
 * place of its own: `chipOf` names the chip that draws any node, and `areaOf` the
 * area that chip sits in.
 */
export interface MapIndex {
  readonly map: ArchitectureMap;
  readonly nodes: ReadonlyMap<string, ArchitectureNode>;
  readonly areas: ReadonlyMap<string, ArchitectureArea>;
  readonly runtimes: ReadonlyMap<string, ArchitectureRuntime>;
  /** Id of the chip that draws each node; a top-level node draws itself. */
  readonly chipOf: ReadonlyMap<string, string>;
  /** The nodes whose `parent` is the key, by name. */
  readonly childrenOf: ReadonlyMap<string, readonly ArchitectureNode[]>;
  /** Every node drawn inside a chip, by name, not counting the chip itself. */
  readonly daughtersOf: ReadonlyMap<string, readonly ArchitectureNode[]>;
  /** The chips of each area, by name. */
  readonly chipsOfArea: ReadonlyMap<string, readonly ArchitectureNode[]>;
  readonly areasOfRuntime: ReadonlyMap<string, readonly ArchitectureArea[]>;
  readonly edgesOut: ReadonlyMap<string, readonly ArchitectureEdge[]>;
  readonly edgesIn: ReadonlyMap<string, readonly ArchitectureEdge[]>;
}

function pushTo<K, V>(into: Map<K, V[]>, key: K, value: V): void {
  const list = into.get(key);
  if (list) list.push(value);
  else into.set(key, [value]);
}

/** The topmost ancestor of a node, stopping at a parent that is missing or loops back. */
function topAncestor(node: ArchitectureNode, nodes: ReadonlyMap<string, ArchitectureNode>): string {
  const seen = new Set<string>([node.id]);
  let top = node;
  for (;;) {
    const parent = top.parent === null ? undefined : nodes.get(top.parent);
    if (!parent || seen.has(parent.id)) return top.id;
    seen.add(parent.id);
    top = parent;
  }
}

/** The chip that draws each node. Nodes whose parents loop have no top, so each is drawn on its own. */
function drawnIn(
  map: ArchitectureMap,
  nodes: ReadonlyMap<string, ArchitectureNode>,
): Map<string, string> {
  const tops = new Map(map.nodes.map((node) => [node.id, topAncestor(node, nodes)]));
  return new Map(
    map.nodes.map(({ id }) => {
      const top = tops.get(id) ?? id;
      return [id, tops.get(top) === top ? top : id];
    }),
  );
}

const byName = (a: ArchitectureNode, b: ArchitectureNode): number =>
  a.group.localeCompare(b.group) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

export function indexMap(map: ArchitectureMap): MapIndex {
  const nodes = new Map(map.nodes.map((node) => [node.id, node]));
  const chipOf = drawnIn(map, nodes);

  const childrenOf = new Map<string, ArchitectureNode[]>();
  const daughtersOf = new Map<string, ArchitectureNode[]>();
  const chipsOfArea = new Map<string, ArchitectureNode[]>();
  for (const node of [...map.nodes].sort(byName)) {
    if (node.parent !== null && nodes.has(node.parent)) pushTo(childrenOf, node.parent, node);
    const chip = chipOf.get(node.id) ?? node.id;
    if (chip === node.id) pushTo(chipsOfArea, node.area, node);
    else pushTo(daughtersOf, chip, node);
  }

  const areasOfRuntime = new Map<string, ArchitectureArea[]>();
  for (const area of map.areas) pushTo(areasOfRuntime, area.runtime, area);

  const edgesOut = new Map<string, ArchitectureEdge[]>();
  const edgesIn = new Map<string, ArchitectureEdge[]>();
  for (const edge of map.edges) {
    pushTo(edgesOut, edge.from, edge);
    pushTo(edgesIn, edge.to, edge);
  }

  return {
    map,
    nodes,
    areas: new Map(map.areas.map((area) => [area.id, area])),
    runtimes: new Map(map.runtimes.map((runtime) => [runtime.id, runtime])),
    chipOf,
    childrenOf,
    daughtersOf,
    chipsOfArea,
    areasOfRuntime,
    edgesOut,
    edgesIn,
  };
}

/** The area whose bay draws a node: where its chip sits, which a daughter shares with its ancestor. */
export function drawnAreaOf(index: MapIndex, nodeId: string): string | undefined {
  const chip = index.chipOf.get(nodeId);
  return chip === undefined ? undefined : index.nodes.get(chip)?.area;
}

export function runtimeOfArea(index: MapIndex, areaId: string): ArchitectureRuntime | undefined {
  const area = index.areas.get(areaId);
  return area === undefined ? undefined : index.runtimes.get(area.runtime);
}

/** Every node that belongs to an area, by the area it was scanned into. */
export function nodesOfArea(index: MapIndex, areaId: string): ArchitectureNode[] {
  return index.map.nodes.filter((node) => node.area === areaId);
}

export function nodesOfRuntime(index: MapIndex, runtimeId: string): ArchitectureNode[] {
  const areas = new Set((index.areasOfRuntime.get(runtimeId) ?? []).map(({ id }) => id));
  return index.map.nodes.filter((node) => areas.has(node.area));
}
