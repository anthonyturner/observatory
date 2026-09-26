import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { PROJECTS } from '../projects/projects-source';
import { Bead, BeadLayout, layoutBeads } from './beads';
import { CoreView } from './core-view';
import { Lens } from './lens';

/** A bead where it sits on the screen, and how far from it still counts as on it. */
export interface PlacedBead {
  readonly bead: Bead;
  readonly x: number;
  readonly y: number;
  /** Radius of the drawn bead, in CSS pixels. */
  readonly radius: number;
}

const EMPTY: BeadLayout = { beads: [], overflow: null };
/** A bead's glow is about this many of its radii wide; a hand within it is on the bead. */
const HIT_REACH = 2.6;
/** Small beads still get a target big enough for a finger. */
const MIN_HIT_PX = 12;

/** Where the core is on the screen and where its beads sit: measured by the
 *  canvas, read by the surface that takes the pointer and by the labels. */
@Injectable({ providedIn: 'root' })
export class CoreGeometry {
  private readonly projects = inject(PROJECTS);
  private readonly currentView = signal<CoreView | null>(null);
  private readonly radius = computed(() => this.currentView()?.radius ?? null);

  readonly view: Signal<CoreView | null> = this.currentView.asReadonly();
  readonly layout: Signal<BeadLayout> = computed(() => {
    const radius = this.radius();
    return radius === null ? EMPTY : layoutBeads(this.projects(), radius);
  });

  place(view: CoreView): void {
    this.currentView.set(view);
  }

  /** Every bead on the screen, as the lens sees it now. */
  placed(): PlacedBead[] {
    const view = this.currentView();
    if (!view || view.isAway) return [];
    const lens = new Lens();
    lens.aim(view);
    return this.layout().beads.map((bead) => {
      const seen = lens.project(bead.x, bead.y, bead.z);
      return { bead, x: seen.x, y: seen.y, radius: bead.size * seen.scale };
    });
  }
}

/** The bead under a point, nearest first, or null. */
export function beadAt(beads: readonly PlacedBead[], x: number, y: number): Bead | null {
  let best: { bead: Bead; distance: number } | null = null;
  for (const placed of beads) {
    const distance = Math.hypot(placed.x - x, placed.y - y);
    const reach = Math.max(MIN_HIT_PX, placed.radius * HIT_REACH);
    if (distance <= reach && (!best || distance < best.distance))
      best = { bead: placed.bead, distance };
  }
  return best?.bead ?? null;
}
