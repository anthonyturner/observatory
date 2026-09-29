import { Line, LineDashedMaterial, QuadraticBezierCurve3, Scene } from 'three';
import { Kit, vec } from './gpu-kit';
import { LogThreads } from './sky-frame';
import { SkyStar, WORLD } from './sky-model';

/** Points along each thread's curve. */
const THREAD_POINTS = 24;
const THREAD_OPACITY = 0.6;
/** How far each thread bows toward the middle of the sky, and back into it. */
const BOW_TO_CENTRE = 0.35;
const BOW_DEPTH = -100;

/**
 * The log sky's threads in the 3D scene, as pr-starmap drew them: from the
 * traced fault to each window where the same fault fires, dashed, bowed toward
 * the middle and back into the sky, so they pass behind nearer stars rather
 * than over them. Rebuilt only when the traced fault changes.
 */
export class Threads3D {
  private traced: SkyStar | null = null;
  private lines: { readonly line: Line; readonly end: SkyStar }[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly kit: Kit,
  ) {}

  update(threads: LogThreads | null, scale: number): void {
    if ((threads?.traced ?? null) !== this.traced) this.rebuild(threads);
    const traced = this.traced;
    if (!traced) return;
    const from = vec(traced.ax, traced.ay, traced.az);
    const middle = vec(WORLD.w / 2, WORLD.h / 2, BOW_DEPTH);
    for (const { line, end } of this.lines) {
      const to = vec(end.ax, end.ay, end.az);
      const bow = from.clone().lerp(to, 0.5).lerp(middle, BOW_TO_CENTRE);
      const position = line.geometry.attributes['position'];
      new QuadraticBezierCurve3(from, bow, to)
        .getPoints(THREAD_POINTS)
        .forEach((point, i) => position.setXYZ(i, point.x, point.y, point.z));
      position.needsUpdate = true;
      line.geometry.computeBoundingSphere();
      line.computeLineDistances();
      (line.material as LineDashedMaterial).scale = scale;
    }
  }

  dispose(): void {
    this.rebuild(null);
  }

  private rebuild(threads: LogThreads | null): void {
    for (const { line } of this.lines) this.kit.owned.release(line);
    this.lines = [];
    this.traced = threads?.traced ?? null;
    if (!threads) return;
    const start = Array.from({ length: THREAD_POINTS + 1 }, () => vec(0, 0));
    this.lines = threads.twins.map((end) => {
      const line = this.kit.line(start, threads.traced.colour, THREAD_OPACITY, true);
      this.scene.add(line);
      return { line, end };
    });
  }
}
