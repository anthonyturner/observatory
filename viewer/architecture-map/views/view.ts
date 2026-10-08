import type { MapIndex } from '../model/map-index.ts';
import type { MapStore } from '../model/map-store.ts';

/** What the reader has asked their system for; a view with animation must honour it as it changes. */
export interface MotionPreference {
  readonly reduced: boolean;
  /** Calls `listener` whenever `reduced` changes; returns the function that stops it. */
  onChange(listener: () => void): () => void;
}

/** Everything the shell shares with a view. A view reads and changes the map only through these. */
export interface ViewContext {
  readonly index: MapIndex;
  readonly store: MapStore;
  readonly motion: MotionPreference;
}

/** One line of a legend: what a colour or a line style stands for in this view. */
export interface LegendEntry {
  readonly label: string;
  readonly colour: string;
  readonly swatch: 'box' | 'dashed-box' | 'dot';
}

export interface LegendGroup {
  readonly title: string;
  readonly entries: readonly LegendEntry[];
}

/** A mounted view, as the shell keeps it. */
export interface ViewHandle {
  /** The tab was opened or left: a view with an animation loop or a large canvas starts or pauses it. */
  setActive(active: boolean): void;
  destroy(): void;
}

/**
 * A way of drawing the map. The shell lists views as tabs, mounts one the first time its
 * tab opens, and gives it a `host` that fills the view area. To add a view, write a module
 * that exports a `MapView` and add it to `views/registry.ts`; the shell is not edited.
 */
export interface MapView {
  /** Unique; kept in the shell's state as the open tab. */
  readonly id: string;
  /** The tab's text. */
  readonly label: string;
  /** One line of how to move around the view, shown while it is open. */
  readonly hint: string;
  /** What this view's own shapes and colours stand for; the shell adds the edge kinds and marks. */
  readonly legend: readonly LegendGroup[];
  mount(host: HTMLElement, context: ViewContext): ViewHandle;
}
