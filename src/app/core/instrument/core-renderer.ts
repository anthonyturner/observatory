import { ProjectSnapshot } from '../projects/project.types';
import { CoreMood } from './core-mood';
import { CoreStateId } from './core-states';
import { HandPose } from './hand';
import { CoreView } from './core-view';

/** One frame to draw. */
export interface CoreFrame {
  /** Scene seconds, which stop while the core is still. */
  readonly time: number;
  /** Real seconds. */
  readonly wall: number;
  readonly state: CoreStateId;
  /** Real seconds since the core entered `state`. */
  readonly stateAge: number;
  readonly isStill: boolean;
  readonly hand: HandPose;
  /** The repo of the project lit on the ring, if any. */
  readonly litKey: string | null;
  /** How the projects stand, which quickens and warms the core. */
  readonly mood: CoreMood;
}

/** Draws the core. The 2D and 3D renderers both implement it, so choosing
 *  one never edits the other. */
export interface CoreRenderer {
  /** Puts its own canvas in `host`. `redraw` asks for a frame when the
   *  renderer changes on its own, as when a better one finishes loading. */
  mount(host: HTMLElement, redraw: () => void): void;
  /** False when there is nothing to draw with, as in a test's DOM. */
  canDraw(): boolean;
  setProjects(projects: readonly ProjectSnapshot[]): void;
  setView(view: CoreView): void;
  frame(frame: CoreFrame): void;
  dispose(): void;
}
