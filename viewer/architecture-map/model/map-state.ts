import { drawnAreaOf, type MapIndex } from './map-index.ts';

/** How much of the map a view opens up: whole areas, the classes in them, or each class's members. */
export const ZOOM_LEVELS = ['areas', 'classes', 'members'] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

export type SelectionKind = 'node' | 'area' | 'runtime';

/** What every view highlights: one node, or a whole area or runtime. */
export interface Selection {
  readonly kind: SelectionKind;
  readonly id: string;
}

/** What is shared by every view, so that picking something in one is picked in all. */
export interface MapState {
  readonly view: string;
  readonly selection: Selection | null;
  readonly level: ZoomLevel;
  /**
   * The areas whose open or closed state is the opposite of what `level` gives them,
   * so changing the level never has to remember which areas were opened by hand.
   */
  readonly flipped: ReadonlySet<string>;
  readonly marks: boolean;
}

/** A map this large starts at areas, because laying out every class would swamp the board. */
export const CLASS_LEVEL_NODE_LIMIT = 150;

export const nodeSelection = (id: string): Selection => ({ kind: 'node', id });

export function initialState(index: MapIndex, view: string): MapState {
  return {
    view,
    selection: null,
    level: index.map.nodes.length > CLASS_LEVEL_NODE_LIMIT ? 'areas' : 'classes',
    flipped: new Set(),
    marks: true,
  };
}

/** Whether an area shows as a closed box. At the areas level that is every area not opened by hand. */
export const isCollapsed = (state: MapState, areaId: string): boolean =>
  (state.level === 'areas') !== state.flipped.has(areaId);

/** The two things a view must lay out again for; everything else only restyles. */
export const disclosureOf = (state: MapState): string =>
  `${state.level}|${[...state.flipped].sort().join(',')}`;

function withAreaOpen(state: MapState, areaId: string | undefined): MapState {
  if (areaId === undefined || !isCollapsed(state, areaId)) return state;
  return toggleArea(state, areaId);
}

/** The area a selection needs open to be seen, if it names one. */
function areaToReveal(index: MapIndex, selection: Selection): string | undefined {
  if (selection.kind === 'area') return selection.id;
  return selection.kind === 'node' ? drawnAreaOf(index, selection.id) : undefined;
}

/** Selecting opens the area that holds the selection, so it is never picked out of sight. */
export function select(state: MapState, index: MapIndex, selection: Selection | null): MapState {
  const unchanged =
    state.selection?.kind === selection?.kind && state.selection?.id === selection?.id;
  if (unchanged) return state;
  const picked = { ...state, selection };
  return selection === null ? picked : withAreaOpen(picked, areaToReveal(index, selection));
}

export function setLevel(state: MapState, index: MapIndex, level: ZoomLevel): MapState {
  if (level === state.level) return state;
  const moved = { ...state, level, flipped: new Set<string>() };
  const { selection } = moved;
  return selection === null ? moved : withAreaOpen(moved, areaToReveal(index, selection));
}

export function toggleArea(state: MapState, areaId: string): MapState {
  const flipped = new Set(state.flipped);
  if (!flipped.delete(areaId)) flipped.add(areaId);
  return { ...state, flipped };
}

export const toggleMarks = (state: MapState): MapState => ({ ...state, marks: !state.marks });

export const setView = (state: MapState, view: string): MapState =>
  view === state.view ? state : { ...state, view };
