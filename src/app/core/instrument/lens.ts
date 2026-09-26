import { CoreView } from './core-view';
import { CAMERA_DEPTH } from './proportions';

/** A point on the screen, and how much nearer than the core's centre it is. */
export interface ScreenPoint {
  x: number;
  y: number;
  scale: number;
}

/** Sees the scene through one camera, CAMERA_DEPTH away and centred on the window. */
export class Lens {
  private view: CoreView | null = null;
  /** Reused on every call: the 2D core projects thousands of points a frame,
   *  and a new object for each would feed the garbage collector a steady diet. */
  private readonly point: ScreenPoint = { x: 0, y: 0, scale: 1 };

  aim(view: CoreView): void {
    this.view = view;
  }

  /** Valid until the next call. */
  project(x: number, y: number, z: number): ScreenPoint {
    const view = this.view;
    const scale = CAMERA_DEPTH / (CAMERA_DEPTH - z);
    const midX = (view?.width ?? 0) / 2;
    const midY = (view?.height ?? 0) / 2;
    this.point.x = midX + ((view?.centreX ?? 0) + x - midX) * scale;
    this.point.y = midY + ((view?.centreY ?? 0) + y - midY) * scale;
    this.point.scale = scale;
    return this.point;
  }
}
