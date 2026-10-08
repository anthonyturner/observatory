import type { Selection } from '../../model/map-state.ts';
import type { Scope } from '../../model/scope.ts';
import { el, svg } from '../../shell/dom.ts';
import type { BoardLayout, Box } from './board-layout.ts';
import type { BayModel, Board, RigModel } from './board-model.ts';
import { chipElement, type ChipDrawing } from './chip-element.ts';
import { bayElement, rigElement } from './frame-element.ts';
import { traceElement, type TraceDrawing } from './trace-element.ts';

/** With nothing selected, only this many flow traces pulse, so a large board stays calm and cheap. */
const IDLE_PULSE_LIMIT = 40;

/** A board with more traces than this draws them faint until something is selected, so the lines do not drown the boxes. */
const DENSE_TRACE_COUNT = 120;

/** What the drawing needs to know to style itself; none of it changes where anything is. */
export interface Paint {
  readonly scope: Scope | null;
  readonly selection: Selection | null;
  readonly marks: boolean;
  readonly reducedMotion: boolean;
}

/** The board as page elements, with the means to restyle it as the selection changes. */
export interface BoardDrawing {
  readonly element: HTMLElement;
  paint(paint: Paint): void;
  /** The box on the board that shows a node, to bring into view. */
  boxFor(nodeId: string): Box | undefined;
  /** The box of the bay that shows an area, to bring into view. */
  boxForArea(areaId: string): Box | undefined;
}

/** A rig or bay: dimmed when none of its nodes is in scope, marked when it is what is selected. */
interface Frame {
  readonly element: HTMLElement;
  readonly nodeIds: readonly string[];
  readonly selects: Selection;
}

const toggle = (element: Element, name: string, on: boolean): void => {
  element.classList.toggle(name, on);
};

const outOfScope = (scope: Scope | null, nodeIds: readonly string[]): boolean =>
  scope !== null && !nodeIds.some((id) => scope.nodes.has(id));

function paintFrames(frames: readonly Frame[], { scope, selection }: Paint): void {
  for (const { element, nodeIds, selects } of frames) {
    toggle(element, 'is-dim', outOfScope(scope, nodeIds));
    toggle(element, 'is-selected', selection?.kind === selects.kind && selection.id === selects.id);
  }
}

function paintChips(chips: readonly ChipDrawing[], { scope, selection }: Paint): void {
  const picked = selection?.kind === 'node' ? selection.id : null;
  for (const chip of chips) {
    const holdsPicked = picked !== null && chip.nodeId !== picked && chip.nodeIds.includes(picked);
    toggle(chip.element, 'is-dim', outOfScope(scope, chip.nodeIds));
    toggle(chip.element, 'is-selected', chip.nodeId === picked);
    toggle(chip.element, 'is-holding', holdsPicked);
    toggle(
      chip.element,
      'is-linked',
      scope !== null && chip.nodeId !== picked && scope.nodes.has(chip.nodeId),
    );
    for (const daughter of chip.daughters) {
      toggle(daughter.element, 'is-dim', outOfScope(scope, [daughter.nodeId]));
      toggle(daughter.element, 'is-selected', daughter.nodeId === picked);
    }
  }
}

function paintTraces(traces: readonly TraceDrawing[], layer: SVGElement, paint: Paint): void {
  const { scope, reducedMotion } = paint;
  let idlePulses = 0;
  const lit: TraceDrawing[] = [];
  for (const trace of traces) {
    const on = scope === null || trace.model.edges.some((edge) => scope.lights(edge));
    const idlePulse = trace.model.flow && idlePulses < IDLE_PULSE_LIMIT;
    toggle(trace.element, 'is-dim', !on);
    toggle(trace.element, 'is-lit', on && scope !== null);
    const pulses = !reducedMotion && on && (scope !== null || idlePulse);
    if (pulses && scope === null) idlePulses++;
    trace.setPulse(pulses);
    if (on && scope !== null) lit.push(trace);
  }
  for (const trace of lit) layer.append(trace.element);
}

/** Every drawn piece, gathered as the rigs are walked, in the order the page should hold them. */
interface Gathered {
  readonly boxes: Element[];
  readonly chips: ChipDrawing[];
  readonly frames: Frame[];
  readonly nodeBoxes: Map<string, Box>;
  readonly areaBoxes: Map<string, Box>;
}

/** The nodes each chip or closed bay stands for, from the anchors the board gave them. */
function nodesByBox(board: Board): Map<string, string[]> {
  const byBox = new Map<string, string[]>();
  for (const [nodeId, boxId] of board.anchorOf)
    byBox.set(boxId, [...(byBox.get(boxId) ?? []), nodeId]);
  return byBox;
}

function gatherBay(
  bay: BayModel,
  layout: BoardLayout,
  board: Board,
  byBox: ReadonlyMap<string, string[]>,
  into: Gathered,
): readonly string[] {
  const box = layout.boxes.get(bay.id);
  if (!box) return [];
  const nodeIds = bay.collapsed
    ? (byBox.get(bay.id) ?? [])
    : bay.chips.flatMap((chip) => byBox.get(chip.id) ?? []);
  const element = bayElement(bay, box, board.internalLinks.get(bay.id) ?? 0);
  into.boxes.push(element);
  into.frames.push({ element, nodeIds, selects: { kind: 'area', id: bay.area.id } });
  into.areaBoxes.set(bay.area.id, box);
  for (const id of nodeIds) into.nodeBoxes.set(id, box);
  for (const chip of bay.chips) {
    const chipBox = layout.boxes.get(chip.id);
    if (!chipBox) continue;
    const drawing = chipElement(chip, chipBox);
    into.chips.push(drawing);
    for (const id of drawing.nodeIds) into.nodeBoxes.set(id, chipBox);
  }
  return nodeIds;
}

function gatherRig(
  rig: RigModel,
  layout: BoardLayout,
  board: Board,
  byBox: ReadonlyMap<string, string[]>,
  into: Gathered,
): void {
  const box = layout.boxes.get(rig.id);
  if (!box) return;
  const element = rigElement(rig, box);
  into.boxes.push(element);
  const nodeIds = rig.bays.flatMap((bay) => gatherBay(bay, layout, board, byBox, into));
  into.frames.push({ element, nodeIds, selects: { kind: 'runtime', id: rig.runtime.id } });
}

/** Draws a laid-out board: rigs and bays, then traces, then chips over them so a trace ends under a chip's edge. */
export function drawBoard(board: Board, layout: BoardLayout): BoardDrawing {
  const gathered: Gathered = {
    boxes: [],
    chips: [],
    frames: [],
    nodeBoxes: new Map(),
    areaBoxes: new Map(),
  };
  const byBox = nodesByBox(board);
  for (const rig of board.rigs) gatherRig(rig, layout, board, byBox, gathered);

  const traces = board.traces.flatMap((trace) => {
    const route = layout.routes.get(trace.id);
    return route && route.length >= 2 ? [traceElement(trace, route)] : [];
  });
  const traceLayer = svg(
    'svg',
    { class: 'board__traces', width: layout.width, height: layout.height, 'aria-hidden': 'true' },
    ...traces.map(({ element }) => element),
  );
  const element = el(
    'div',
    { class: 'board__world', style: { width: `${layout.width}px`, height: `${layout.height}px` } },
    ...gathered.boxes,
    traceLayer,
    ...gathered.chips.map((chip) => chip.element),
  );

  return {
    element,
    boxFor: (nodeId) => gathered.nodeBoxes.get(nodeId),
    boxForArea: (areaId) => gathered.areaBoxes.get(areaId),
    paint(paint) {
      toggle(element, 'marks-off', !paint.marks);
      toggle(element, 'is-dense', traces.length > DENSE_TRACE_COUNT);
      paintFrames(gathered.frames, paint);
      paintChips(gathered.chips, paint);
      paintTraces(traces, traceLayer, paint);
    },
  };
}
