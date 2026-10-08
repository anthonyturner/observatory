import { runtimeOfArea, type MapIndex } from './map-index.ts';
import { nodeSelection, type Selection } from './map-state.ts';

/** One step of the path to the selection; choosing it selects that step. */
export interface Crumb {
  readonly label: string;
  readonly selection: Selection;
}

/** Parents of a node from the outermost down, stopping at a missing parent or a loop. */
function parentChain(index: MapIndex, id: string): string[] {
  const chain: string[] = [];
  const seen = new Set([id]);
  let parent = index.nodes.get(id)?.parent;
  while (parent && !seen.has(parent) && index.nodes.has(parent)) {
    chain.unshift(parent);
    seen.add(parent);
    parent = index.nodes.get(parent)?.parent;
  }
  return chain;
}

function areaCrumbs(index: MapIndex, areaId: string): Crumb[] {
  const area = index.areas.get(areaId);
  const runtime = runtimeOfArea(index, areaId);
  if (!area || !runtime) return [];
  return [
    { label: runtime.label, selection: { kind: 'runtime', id: runtime.id } },
    { label: area.label, selection: { kind: 'area', id: area.id } },
  ];
}

/** Runtime, then area, then each parent, then the node: the path from the whole app down to the selection. */
export function breadcrumbs(index: MapIndex, selection: Selection | null): Crumb[] {
  if (selection === null) return [];
  if (selection.kind === 'runtime') {
    const runtime = index.runtimes.get(selection.id);
    return runtime ? [{ label: runtime.label, selection }] : [];
  }
  if (selection.kind === 'area') return areaCrumbs(index, selection.id);
  const node = index.nodes.get(selection.id);
  if (!node) return [];
  const above = parentChain(index, node.id).flatMap((id) => {
    const parent = index.nodes.get(id);
    return parent ? [{ label: parent.name, selection: nodeSelection(id) }] : [];
  });
  return [...areaCrumbs(index, node.area), ...above, { label: node.name, selection }];
}
