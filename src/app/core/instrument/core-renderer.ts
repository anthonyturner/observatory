import { ProjectSnapshot } from '../projects/project.types';
import { CoreStateId } from './core-states';
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
}

/** Draws the core. The 2D and 3D renderers both implement it, so choosing
 *  one never edits the other. */
export interface CoreRenderer {
  /** Takes the canvas it draws on. */
  mount(canvas: HTMLCanvasElement): void;
  /** False when the canvas gave no context to draw with, as in a test's DOM. */
  canDraw(): boolean;
  setProjects(projects: readonly ProjectSnapshot[]): void;
  setView(view: CoreView): void;
  frame(frame: CoreFrame): void;
  dispose(): void;
}
