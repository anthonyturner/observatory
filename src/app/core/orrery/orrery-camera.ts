export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface CameraPose {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.04;
const MAX_SCALE = 3;
/** The share of the gap to the target closed per second: most of it, smoothly. */
const EASE_REMAINING_PER_SECOND = 0.0016;
/** A flick keeps drifting, losing a tenth of its speed every 60th of a second. */
const DRIFT_KEEP_PER_FRAME = 0.9;
const FRAMES_PER_SECOND = 60;
/** Fit leaves room around the outermost orbit for its world and label. */
const FIT_MARGIN = 140;
/** The HUD's top and bottom bars take this much of the height. */
const FIT_CHROME_HEIGHT = 200;
/** An orbit is drawn this much taller than flat, at most. */
const FIT_ORBIT_HEIGHT = 1.35;

export const clampScale = (scale: number): number =>
  Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));

/** A 2D camera over the orrery's plane that eases toward where it is sent. */
export class OrreryCamera {
  readonly current: CameraPose;
  readonly target: CameraPose;
  private drift = { x: 0, y: 0 };

  constructor(start: CameraPose = { x: 0, y: 0, scale: 0.6 }) {
    this.current = { ...start };
    this.target = { ...start };
  }

  /** Screen position of an orrery point. */
  toScreen(x: number, y: number, view: Viewport): readonly [number, number] {
    const { current } = this;
    return [
      (x - current.x) * current.scale + view.width / 2,
      (y - current.y) * current.scale + view.height / 2,
    ];
  }

  /** Orrery position under a screen point. */
  toOrrery(sx: number, sy: number, view: Viewport): readonly [number, number] {
    const { current } = this;
    return [
      (sx - view.width / 2) / current.scale + current.x,
      (sy - view.height / 2) / current.scale + current.y,
    ];
  }

  /** Moves the view with the pointer, and remembers the speed for a flick. */
  drag(dx: number, dy: number): void {
    this.target.x -= dx / this.current.scale;
    this.target.y -= dy / this.current.scale;
    this.drift = { x: -dx, y: -dy };
  }

  stopDrift(): void {
    this.drift = { x: 0, y: 0 };
  }

  /** Pans by screen pixels, as the arrow keys do. */
  pan(dx: number, dy: number): void {
    this.target.x += dx / this.current.scale;
    this.target.y += dy / this.current.scale;
  }

  /** Zooms by `factor`, keeping the point under (sx, sy) where it is. */
  zoomAt(sx: number, sy: number, factor: number, view: Viewport): void {
    const [ox, oy] = this.toOrrery(sx, sy, view);
    const scale = clampScale(this.target.scale * factor);
    this.target.scale = scale;
    this.target.x = ox - (sx - view.width / 2) / scale;
    this.target.y = oy - (sy - view.height / 2) / scale;
  }

  /** Frames the whole system out to `outermostOrbit`. */
  fit(outermostOrbit: number, view: Viewport): void {
    const far = outermostOrbit + FIT_MARGIN;
    this.target.x = 0;
    this.target.y = 0;
    this.target.scale = clampScale(
      Math.min(
        view.width / (far * 2),
        (view.height - FIT_CHROME_HEIGHT) / (far * FIT_ORBIT_HEIGHT),
      ),
    );
  }

  /** Eases the view toward its target over `dt` seconds, and says whether it still moves. */
  advance(dt: number, isDragging: boolean): boolean {
    const { current, target } = this;
    if (!isDragging) {
      target.x += this.drift.x / current.scale;
      target.y += this.drift.y / current.scale;
      const keep = Math.pow(DRIFT_KEEP_PER_FRAME, dt * FRAMES_PER_SECOND);
      this.drift = { x: this.drift.x * keep, y: this.drift.y * keep };
    }
    const closed = 1 - Math.pow(EASE_REMAINING_PER_SECOND, dt);
    current.x += (target.x - current.x) * closed;
    current.y += (target.y - current.y) * closed;
    current.scale += (target.scale - current.scale) * closed;
    return this.isMoving();
  }

  /** Jumps to the target, for a still page. */
  settle(): void {
    Object.assign(this.current, this.target);
    this.stopDrift();
  }

  private isMoving(): boolean {
    const { current, target, drift } = this;
    const near = (a: number, b: number, within: number) => Math.abs(a - b) < within;
    return !(
      near(current.x, target.x, 0.05) &&
      near(current.y, target.y, 0.05) &&
      near(current.scale, target.scale, 0.0005) &&
      Math.hypot(drift.x, drift.y) < 0.05
    );
  }
}
