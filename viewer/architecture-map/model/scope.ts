import type {
  ArchitectureEdge,
  NodeMark,
} from '../../../server/architecture/architecture-types.ts';
import { nodesOfArea, nodesOfRuntime, type MapIndex } from './map-index.ts';
import type { Selection } from './map-state.ts';

/** What stays lit when something is selected: the nodes and the edges every other part dims around. */
export interface Scope {
  readonly nodes: ReadonlySet<string>;
  lights(edge: ArchitectureEdge): boolean;
}

/** The chain of parents above a node, nearest first. */
function ancestorsOf(index: MapIndex, id: string): string[] {
  const chain: string[] = [];
  const seen = new Set([id]);
  let parent = index.nodes.get(id)?.parent;
  while (parent && !seen.has(parent)) {
    chain.push(parent);
    seen.add(parent);
    parent = index.nodes.get(parent)?.parent;
  }
  return chain;
}

/** A node, the nodes it links to or from, the ones above it and the ones directly inside it. */
function neighbourhood(index: MapIndex, id: string): Set<string> {
  const lit = new Set<string>([id, ...ancestorsOf(index, id)]);
  for (const edge of index.edgesOut.get(id) ?? []) lit.add(edge.to);
  for (const edge of index.edgesIn.get(id) ?? []) lit.add(edge.from);
  for (const child of index.childrenOf.get(id) ?? []) lit.add(child.id);
  return lit;
}

/** `null` when nothing is selected, so a view has no dimming to do. */
export function scopeOf(index: MapIndex, selection: Selection | null): Scope | null {
  if (selection === null) return null;
  if (selection.kind === 'node') {
    const { id } = selection;
    return {
      nodes: neighbourhood(index, id),
      lights: (edge) => edge.from === id || edge.to === id,
    };
  }
  const members =
    selection.kind === 'area'
      ? nodesOfArea(index, selection.id)
      : nodesOfRuntime(index, selection.id);
  const nodes = new Set(members.map(({ id }) => id));
  return { nodes, lights: (edge) => nodes.has(edge.from) && nodes.has(edge.to) };
}

/** What the card says of an area or runtime: how many nodes it holds and how many carry each mark. */
export function groupSummary(
  index: MapIndex,
  selection: Selection,
): { readonly nodes: number; readonly marked: ReadonlyMap<NodeMark, number> } {
  const members =
    selection.kind === 'runtime'
      ? nodesOfRuntime(index, selection.id)
      : nodesOfArea(index, selection.id);
  const marked = new Map<NodeMark, number>();
  for (const { marks } of members)
    for (const mark of marks) marked.set(mark, (marked.get(mark) ?? 0) + 1);
  return { nodes: members.length, marked };
}
