import {
  isCodeEdge,
  type ArchitectureArea,
  type ArchitectureEdge,
  type ArchitectureNode,
  type ArchitectureRuntime,
  type EdgeKind,
  type EdgeMark,
  type NodeMark,
} from '../../../../server/architecture/architecture-types.ts';
import { drawnAreaOf, type MapIndex } from '../../model/map-index.ts';
import { isCollapsed, type MapState } from '../../model/map-state.ts';
import { chipSize, type ChipSize } from './chip-metrics.ts';

export const COLLAPSED_BAY_WIDTH = 236;
export const COLLAPSED_BAY_HEIGHT = 104;

export interface ChipModel {
  /** The id the layout and the page know this chip by. */
  readonly id: string;
  readonly node: ArchitectureNode;
  readonly size: ChipSize;
}

export interface BayModel {
  readonly id: string;
  readonly area: ArchitectureArea;
  readonly collapsed: boolean;
  /** Empty while collapsed: a closed bay is one box, not its chips. */
  readonly chips: readonly ChipModel[];
  /** Classes drawn in this bay, daughters included. */
  readonly classes: number;
  readonly marked: ReadonlyMap<NodeMark, number>;
}

export interface RigModel {
  readonly id: string;
  readonly runtime: ArchitectureRuntime;
  readonly bays: readonly BayModel[];
  readonly classes: number;
  readonly cycles: number;
}

/** One drawn trace: every edge of one kind between the same two boxes, merged into it. */
export interface TraceModel {
  readonly id: string;
  /** Ids of the chips or closed bays it joins. */
  readonly from: string;
  readonly to: string;
  readonly kind: EdgeKind;
  readonly flow: boolean;
  readonly edges: readonly ArchitectureEdge[];
  readonly marks: readonly EdgeMark[];
}

export interface Board {
  readonly rigs: readonly RigModel[];
  readonly traces: readonly TraceModel[];
  /** The chip or closed bay that stands for each node on the board. */
  readonly anchorOf: ReadonlyMap<string, string>;
  /** How many links join two classes inside the same chip or closed bay, which have no trace of their own. */
  readonly internalLinks: ReadonlyMap<string, number>;
}

const rigId = (runtimeId: string): string => `rig:${runtimeId}`;
export const bayId = (areaId: string): string => `bay:${areaId}`;
export const chipId = (nodeId: string): string => `chip:${nodeId}`;

function bayOf(index: MapIndex, state: MapState, area: ArchitectureArea): BayModel | null {
  const topLevel = index.chipsOfArea.get(area.id) ?? [];
  if (topLevel.length === 0) return null;
  const collapsed = isCollapsed(state, area.id);
  const nodes = topLevel.flatMap((node) => [node, ...(index.daughtersOf.get(node.id) ?? [])]);
  const marked = new Map<NodeMark, number>();
  for (const { marks } of nodes)
    for (const mark of marks) marked.set(mark, (marked.get(mark) ?? 0) + 1);
  const chips = collapsed
    ? []
    : topLevel.map((node) => ({
        id: chipId(node.id),
        node,
        size: chipSize(node, index.daughtersOf.get(node.id) ?? [], state.level),
      }));
  return { id: bayId(area.id), area, collapsed, chips, classes: nodes.length, marked };
}

function rigsOf(index: MapIndex, state: MapState): RigModel[] {
  return index.map.runtimes.flatMap((runtime) => {
    const bays = (index.areasOfRuntime.get(runtime.id) ?? []).flatMap(
      (area) => bayOf(index, state, area) ?? [],
    );
    if (bays.length === 0) return [];
    const classes = bays.reduce((sum, bay) => sum + bay.classes, 0);
    const cycles = bays.reduce((sum, bay) => sum + (bay.marked.get('cycle') ?? 0), 0);
    return [{ id: rigId(runtime.id), runtime, bays, classes, cycles }];
  });
}

function anchorsOf(index: MapIndex, rigs: readonly RigModel[]): Map<string, string> {
  const bays = new Map(rigs.flatMap((rig) => rig.bays.map((bay) => [bay.area.id, bay] as const)));
  const anchors = new Map<string, string>();
  for (const node of index.map.nodes) {
    const areaId = drawnAreaOf(index, node.id);
    const bay = areaId === undefined ? undefined : bays.get(areaId);
    const chip = index.chipOf.get(node.id);
    if (bay && chip !== undefined) anchors.set(node.id, bay.collapsed ? bay.id : chipId(chip));
  }
  return anchors;
}

/** The kind most of these edges are, the first met winning a tie. */
function dominantKind(edges: readonly ArchitectureEdge[]): EdgeKind {
  const counts = new Map<EdgeKind, number>();
  for (const { kind } of edges) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return [...counts].reduce((best, each) => (each[1] > best[1] ? each : best))[0];
}

/**
 * Edges between two boxes of the board. Between two chips each kind gets its own trace; once a
 * closed bay is an end, all the code edges between the same two boxes share one trace, and all
 * the flow edges another, coloured by the kind most of them are, so a crowd of areas stays legible.
 */
function tracesOf(
  index: MapIndex,
  anchors: ReadonlyMap<string, string>,
  closed: ReadonlySet<string>,
): { traces: TraceModel[]; internal: Map<string, number> } {
  const grouped = new Map<string, { from: string; to: string; edges: ArchitectureEdge[] }>();
  const internal = new Map<string, number>();
  for (const edge of index.map.edges) {
    const from = anchors.get(edge.from);
    const to = anchors.get(edge.to);
    if (from === undefined || to === undefined) continue;
    if (from === to) {
      internal.set(from, (internal.get(from) ?? 0) + 1);
      continue;
    }
    const aggregated = closed.has(from) || closed.has(to);
    const key = `${from}
${to}
${aggregated ? isCodeEdge(edge) : edge.kind}`;
    const group = grouped.get(key) ?? { from, to, edges: [] };
    group.edges.push(edge);
    grouped.set(key, group);
  }
  const traces = [...grouped.values()].map(({ from, to, edges }, at) => {
    const kind = dominantKind(edges);
    return {
      id: `trace:${at}`,
      from,
      to,
      kind,
      edges,
      flow: !isCodeEdge({ kind }),
      marks: [...new Set(edges.flatMap((edge) => edge.marks))],
    };
  });
  return { traces, internal };
}

/** Everything the Circuit draws for the current zoom and collapse state, before it is laid out. */
export function buildBoard(index: MapIndex, state: MapState): Board {
  const rigs = rigsOf(index, state);
  const anchorOf = anchorsOf(index, rigs);
  const closed = new Set(
    rigs.flatMap((rig) => rig.bays.filter((bay) => bay.collapsed).map((bay) => bay.id)),
  );
  const { traces, internal } = tracesOf(index, anchorOf, closed);
  return { rigs, traces, anchorOf, internalLinks: internal };
}
