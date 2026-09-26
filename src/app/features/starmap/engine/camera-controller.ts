/** Where the camera looks, and how far in. */
export interface CameraPose {
  x: number;
  y: number;
  scale: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export interface ScreenBox {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** The viewport in CSS pixels, read each time so a resize is picked up. */
export type ViewSize = () => { readonly width: number; readonly height: number };

/**
 * pr-starmap's camera, chased, never set: everything the viewer does moves a
 * target and the camera eases toward it. `distance` is the 3D camera's, so a
 * point at depth `z` projects as the perspective renderer draws it.
 */
export class CameraController {
  readonly current: CameraPose;
  readonly target: CameraPose;
  readonly velocity: Velocity = { x: 0, y: 0 };

  constructor(
    initial: CameraPose,
    readonly distance: number,
    private readonly view: ViewSize,
  ) {
    this.current = { ...initial };
    this.target = { ...initial };
  }

  depth(z = 0): number {
    return this.distance / (this.distance - z);
  }

  project(x: number, y: number, z = 0): [number, number] {
    const { width, height } = this.view();
    const { current } = this;
    return [
      (x - current.x) * current.scale * this.depth(z) + width / 2,
      (y - current.y) * current.scale * this.depth(z) + height / 2,
    ];
  }

  unproject(sx: number, sy: number, z = 0): [number, number] {
    const { width, height } = this.view();
    const scale = this.current.scale * this.depth(z);
    return [(sx - width / 2) / scale + this.current.x, (sy - height / 2) / scale + this.current.y];
  }

  chase(dt: number, dragging: boolean): void {
    const { target, velocity, current } = this;
    if (!dragging) {
      target.x += velocity.x / current.scale;
      target.y += velocity.y / current.scale;
      velocity.x *= Math.pow(0.9, dt * 60);
      velocity.y *= Math.pow(0.9, dt * 60);
    }
    const k = 1 - Math.pow(0.0016, dt);
    current.x += (target.x - current.x) * k;
    current.y += (target.y - current.y) * k;
    current.scale += (target.scale - current.scale) * k;
  }

  /** Refines a fit in projected space, so near stars do not slip off a phone's edge. */
  frameBounds(points: readonly { x: number; y: number; z: number }[], box: ScreenBox): void {
    const { width, height } = this.view();
    const { target } = this;
    for (let pass = 0; pass < 3; pass++) {
      const positions = points.map((p) => [
        (p.x - target.x) * target.scale * this.depth(p.z) + width / 2,
        (p.y - target.y) * target.scale * this.depth(p.z) + height / 2,
      ]);
      if (!positions.length) return;
      const xs = positions.map((p) => p[0]);
      const ys = positions.map((p) => p[1]);
      const x0 = Math.min(...xs);
      const x1 = Math.max(...xs);
      const y0 = Math.min(...ys);
      const y1 = Math.max(...ys);
      const scale = Math.min(
        1,
        (box.right - box.left) / Math.max(1, x1 - x0),
        (box.bottom - box.top) / Math.max(1, y1 - y0),
      );
      target.x += ((x0 + x1) / 2 - (box.left + box.right) / 2) / target.scale;
      target.y += ((y0 + y1) / 2 - (box.top + box.bottom) / 2) / target.scale;
      target.scale *= scale;
    }
  }

  settled(): boolean {
    const { target, current, velocity } = this;
    return (
      Math.abs(target.x - current.x) < 0.4 &&
      Math.abs(target.y - current.y) < 0.4 &&
      Math.abs(target.scale - current.scale) < 0.0008 &&
      Math.abs(velocity.x) < 0.4 &&
      Math.abs(velocity.y) < 0.4
    );
  }
}

export const clampScale = (s: number): number => Math.max(0.04, Math.min(3.2, s));
