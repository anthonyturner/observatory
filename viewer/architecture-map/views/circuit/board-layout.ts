import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';
import {
  COLLAPSED_BAY_HEIGHT,
  COLLAPSED_BAY_WIDTH,
  type BayModel,
  type Board,
  type RigModel,
} from './board-model.ts';

/** Runs ELK on a graph and resolves to the same graph with positions and routes. */
export type ElkRunner = (graph: ElkNode) => Promise<ElkNode>;

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Where everything on the board sits, from the top left of the board, in board pixels. */
export interface BoardLayout {
  readonly width: number;
  readonly height: number;
  /** The box of each rig, bay and chip, by its board id. */
  readonly boxes: ReadonlyMap<string, Box>;
  /** The right-angled path of each trace, by its id, from the box it leaves to the box it enters. */
  readonly routes: ReadonlyMap<string, readonly Point[]>;
}

/** Room a rig and a bay keep clear above their contents for their headers. */
const RIG_PADDING = '[top=64,left=18,bottom=18,right=18]';
const BAY_PADDING = '[top=38,left=14,bottom=14,right=14]';
const BOARD_PADDING = '[top=24,left=24,bottom=24,right=24]';

const ROOT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.padding': BOARD_PADDING,
  'elk.spacing.nodeNode': '30',
  'elk.spacing.edgeEdge': '10',
  'elk.spacing.edgeNode': '16',
  'elk.layered.spacing.nodeNodeBetweenLayers': '70',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '10',
  'elk.layered.spacing.edgeNodeBetweenLayers': '18',
} as const;

/** Wraps a long chain of layers into rows, so a crowded bay grows both ways instead of into one long row. */
const WRAPPED = { 'elk.layered.wrapping.strategy': 'MULTI_EDGE' } as const;

/**
 * A board with this many boxes and traces is laid out with fewer crossing-reduction passes:
 * on a 400-node, 1200-edge map that cut the time to a third for a few more crossings.
 */
const LARGE_BOARD = 400;
const THOROUGHNESS = { standard: '7', large: '2' } as const;

function bayNode(bay: BayModel): ElkNode {
  if (bay.collapsed) {
    return { id: bay.id, width: COLLAPSED_BAY_WIDTH, height: COLLAPSED_BAY_HEIGHT };
  }
  return {
    id: bay.id,
    layoutOptions: { ...WRAPPED, 'elk.padding': BAY_PADDING },
    children: bay.chips.map(({ id, size }) => ({ id, width: size.width, height: size.height })),
  };
}

const rigNode = (rig: RigModel): ElkNode => ({
  id: rig.id,
  layoutOptions: { 'elk.padding': RIG_PADDING },
  children: rig.bays.map(bayNode),
});

/** The board as ELK sees it: rigs holding bays holding chips, and every trace as an edge. */
export function toElkGraph(board: Board): ElkNode {
  const boxes = board.rigs.reduce(
    (sum, rig) => sum + rig.bays.reduce((inRig, bay) => inRig + 1 + bay.chips.length, 0),
    0,
  );
  const large = boxes + board.traces.length > LARGE_BOARD;
  return {
    id: 'board',
    layoutOptions: {
      ...ROOT_OPTIONS,
      'elk.layered.thoroughness': large ? THOROUGHNESS.large : THOROUGHNESS.standard,
    },
    children: board.rigs.map(rigNode),
    edges: board.traces.map(({ id, from, to }) => ({ id, sources: [from], targets: [to] })),
  };
}

function absoluteBoxes(root: ElkNode): Map<string, Box> {
  const boxes = new Map<string, Box>();
  const walk = (node: ElkNode, originX: number, originY: number): void => {
    const x = originX + (node.x ?? 0);
    const y = originY + (node.y ?? 0);
    boxes.set(node.id, { x, y, width: node.width ?? 0, height: node.height ?? 0 });
    for (const child of node.children ?? []) walk(child, x, y);
  };
  walk(root, 0, 0);
  return boxes;
}

function routeOf(edge: ElkExtendedEdge, origin: Point): Point[] {
  const section = edge.sections?.[0];
  if (!section) return [];
  return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(({ x, y }) => ({
    x: origin.x + x,
    y: origin.y + y,
  }));
}

/** Turns ELK's answer, where every position is relative to its container, into board positions. */
export function placeLayout(laidOut: ElkNode): BoardLayout {
  const boxes = absoluteBoxes(laidOut);
  const routes = new Map<string, readonly Point[]>();
  const edges: ElkExtendedEdge[] = [];
  const collect = (node: ElkNode): void => {
    edges.push(...(node.edges ?? []));
    node.children?.forEach(collect);
  };
  collect(laidOut);
  for (const edge of edges) {
    const container = boxes.get(edge.container ?? laidOut.id);
    routes.set(edge.id, routeOf(edge, container ?? { x: 0, y: 0 }));
  }
  const root = boxes.get(laidOut.id);
  return { width: root?.width ?? 0, height: root?.height ?? 0, boxes, routes };
}

export async function layoutBoard(board: Board, run: ElkRunner): Promise<BoardLayout> {
  return placeLayout(await run(toElkGraph(board)));
}
