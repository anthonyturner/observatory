import { WORLD } from './sky-model';
import { SkyFrame, SkyLayer } from './sky-frame';
import { SkyStar } from './sky-model';

/** How far each thread bows toward the middle of the sky. */
const BOW_TO_CENTRE = 0.35;

/**
 * The same fault in other windows: threads out of the traced star, bowed
 * toward the centre so threads to neighbours on the ring arc rather than cross
 * the constellations between. One shared cause firing everywhere reads at once.
 */
export class ThreadLayer implements SkyLayer {
  /** The traced star and its twins, found by whoever knows what a fault is. */
  trace: { readonly traced: SkyStar; readonly twins: readonly SkyStar[] } | null = null;

  beneath(c: CanvasRenderingContext2D, f: SkyFrame): void {
    const trace = this.trace;
    if (f.chart !== 'logs' || !trace?.twins.length) return;
    const { traced, twins } = trace;
    const [x0, y0] = f.toScreen(traced.ax, traced.ay, traced.az);
    const [mx, my] = f.toScreen(WORLD.w / 2, WORLD.h / 2);
    c.save();
    c.setLineDash([3, 7]);
    c.lineDashOffset = -f.t * 26;
    c.lineWidth = 1.2;
    c.strokeStyle = traced.colour;
    c.globalAlpha = 0.6;
    c.beginPath();
    for (const s of twins) {
      const [x1, y1] = f.toScreen(s.ax, s.ay, s.az);
      const qx = (x0 + x1) / 2 + (mx - (x0 + x1) / 2) * BOW_TO_CENTRE;
      const qy = (y0 + y1) / 2 + (my - (y0 + y1) / 2) * BOW_TO_CENTRE;
      c.moveTo(x0, y0);
      c.quadraticCurveTo(qx, qy, x1, y1);
    }
    c.stroke();
    c.restore();
  }
}
