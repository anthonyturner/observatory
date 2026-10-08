import type { MapIndex } from './map-index.ts';
import {
  select,
  setLevel,
  setView,
  toggleArea,
  toggleMarks,
  type MapState,
  type Selection,
  type ZoomLevel,
} from './map-state.ts';

export type StateListener = (state: MapState, previous: MapState) => void;

/**
 * The one place the shell and every view read and change what is selected, how far the
 * map is opened and which tab shows. A command that changes nothing notifies no one.
 */
export interface MapStore {
  state(): MapState;
  /** Calls `listener` after each change; returns the function that stops it. */
  subscribe(listener: StateListener): () => void;
  select(selection: Selection | null): void;
  setLevel(level: ZoomLevel): void;
  toggleArea(areaId: string): void;
  toggleMarks(): void;
  setView(view: string): void;
}

export function createMapStore(index: MapIndex, initial: MapState): MapStore {
  let current = initial;
  const listeners = new Set<StateListener>();

  const change = (next: MapState): void => {
    if (next === current) return;
    const previous = current;
    current = next;
    for (const listener of [...listeners]) listener(next, previous);
  };

  return {
    state: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    select: (selection) => change(select(current, index, selection)),
    setLevel: (level) => change(setLevel(current, index, level)),
    toggleArea: (areaId) => change(toggleArea(current, areaId)),
    toggleMarks: () => change(toggleMarks(current)),
    setView: (view) => change(setView(current, view)),
  };
}
