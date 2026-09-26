import { starsByPr } from './collision-layer';
import { SkyFrame, SkyLayer } from './sky-frame';
import { SkyStar } from './sky-model';

/** One step of the plan, as the sky marks it. */
export interface PlanMark {
  readonly pr: number;
  /** A step that must rebase first is marked in red. */
  readonly needsRebase: boolean;
}

/**
 * pr-starmap's merge plan on the sky: a gold path through the stars in merge
 * order, a light running the course so the direction reads without arrows,
 * and each star numbered by its step.
 */
export class PlanLayer implements SkyLayer {
  steps: readonly PlanMark[] = [];
  on = false;
  /** Replay shows the queue as it was; the plan is for the queue as it is. */
  paused = false;

  private shown(f: SkyFrame): { mark: PlanMark; star: SkyStar }[] {
    if (!this.on || this.paused || f.chart !== 'prs') return [];
    const byPr = starsByPr(f.stars);
    return this.steps.flatMap((mark) => {
      const star = byPr.get(mark.pr);
      return star ? [{ mark, star }] : [];
    });
  }

  beneath(c: CanvasRenderingContext2D, f: SkyFrame): void {
    const steps = this.shown(f);
    if (steps.length < 2) return;
    const pts = steps.map(({ star }) => f.toScreen(star.ax, star.ay, star.az));
    c.save();
    c.strokeStyle = '#ffd98a';
    c.lineWidth = 1.6;
    c.globalAlpha = 0.55;
    c.setLineDash([]);
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
    if (!f.frozen) {
      const total = pts.length - 1;
      const u = (f.t * 0.35) % total;
      const i = Math.floor(u);
      const k = u - i;
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const hx = ax + (bx - ax) * k;
      const hy = ay + (by - ay) * k;
      const g = c.createRadialGradient(hx, hy, 0, hx, hy, 16);
      g.addColorStop(0, '#fff3d0');
      g.addColorStop(1, 'rgba(255, 217, 138, 0)');
      c.globalAlpha = 1;
      c.fillStyle = g;
      c.beginPath();
      c.arc(hx, hy, 16, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  labels(ctx: CanvasRenderingContext2D, f: SkyFrame): void {
    const steps = this.shown(f);
    if (!steps.length) return;
    const scale = Math.max(f.camera.current.scale, 0.42);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    steps.forEach(({ mark, star }, i) => {
      const [x, y] = f.toScreen(star.ax, star.ay, star.az);
      const r = star.mag * scale;
      const bx = x + r * 1.4 + 12;
      const by = y - r * 1.4 - 12;
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = mark.needsRebase ? '#3a1712' : '#3a2c0c';
      ctx.strokeStyle = mark.needsRebase ? '#ff8b7d' : '#ffd98a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(bx, by, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff3d0';
      ctx.font = '600 10.5px "IBM Plex Mono", monospace';
      ctx.fillText(String(i + 1), bx, by + 0.5);
    });
    ctx.restore();
  }
}
