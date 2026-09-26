import { rnd } from './rnd';
import { SkyFrame, SkyLayer } from './sky-frame';
import { WORLD } from './sky-model';

/** What a comet needs to be drawn: its issue, and how old and idle it is. */
export interface CometIssue {
  readonly issue: number;
  readonly ageDays: number;
  readonly idleDays: number;
}

/** A comet on its orbit, and where it was last drawn on screen. */
export interface SkyComet<T extends CometIssue = CometIssue> {
  readonly comet: T;
  readonly rx: number;
  readonly ry: number;
  readonly phase: number;
  readonly speed: number;
  readonly mag: number;
  readonly tail: number;
  readonly i: number;
  ax: number;
  ay: number;
}

const COLOUR = '#9fe8ff';
const PICK_REACH = 16;

/**
 * pr-starmap's comets: open issues no pull request closes pass through the sky
 * on long slow orbits, each tail pointing away from the centre. The head grows
 * with the issue's age, the tail with how long it has sat untouched.
 */
export function layoutComets<T extends CometIssue>(
  comets: readonly T[],
  cap: number,
): SkyComet<T>[] {
  return comets.slice(0, cap).map((c, i) => {
    const r = rnd(c.issue * 7331 + 17);
    return {
      comet: c,
      // Orbits pass through the constellations, not around the frame.
      rx: WORLD.w * (0.12 + r() * 0.28),
      ry: WORLD.h * (0.14 + r() * 0.3),
      phase: r() * Math.PI * 2,
      speed: (0.012 + r() * 0.014) * (r() < 0.5 ? 1 : -1),
      mag: 2.4 + Math.min(Math.sqrt(c.ageDays) * 0.45, 5),
      tail: 40 + Math.min(c.idleDays * 2.2, 190),
      ax: 0,
      ay: 0,
      i,
    };
  });
}

export class CometLayer<T extends CometIssue = CometIssue> implements SkyLayer {
  comets: SkyComet<T>[] = [];
  show = true;
  /** Replay shows the queue as it was; comets are the present. */
  paused = false;
  selected: T | null = null;
  private onScreen: { comet: SkyComet<T>; x: number; y: number }[] = [];

  private on(f: SkyFrame): boolean {
    return this.show && !this.paused && f.chart === 'prs' && this.comets.length > 0;
  }

  private place(t: number, frozen: boolean): void {
    for (const k of this.comets) {
      const a = k.phase + (frozen ? 0 : t * k.speed);
      k.ax = WORLD.w / 2 + Math.cos(a) * k.rx;
      k.ay = WORLD.h / 2 + Math.sin(a) * k.ry;
    }
  }

  beneath(c: CanvasRenderingContext2D, f: SkyFrame): void {
    this.onScreen = [];
    if (!this.on(f)) return;
    this.place(f.t, f.frozen);
    const scale = f.camera.current.scale;
    const [cx, cy] = f.toScreen(WORLD.w / 2, WORLD.h / 2);
    c.save();
    for (const k of this.comets) {
      const [x, y] = f.toScreen(k.ax, k.ay);
      this.onScreen.push({ comet: k, x, y });
      if (x < -300 || y < -300 || x > f.width + 300 || y > f.height + 300) continue;
      const d = Math.hypot(x - cx, y - cy) || 1;
      const ux = (x - cx) / d;
      const uy = (y - cy) / d;
      const len = k.tail * Math.max(scale, 0.35);
      const r = k.mag * Math.max(scale, 0.45);
      const flicker = f.frozen ? 1 : 0.85 + Math.sin(f.t * 2.3 + k.i) * 0.15;
      // Two tails, as real comets have: a straight ion tail and a curved dust tail.
      for (const [bend, alpha, width] of [
        [0, 0.55, 1.6],
        [0.35, 0.3, 3.2],
      ]) {
        const tx = x + (ux + -uy * bend) * len;
        const ty = y + (uy + ux * bend) * len;
        const g = c.createLinearGradient(x, y, tx, ty);
        g.addColorStop(0, COLOUR);
        g.addColorStop(1, 'rgba(159, 232, 255, 0)');
        c.globalAlpha = alpha * flicker;
        c.strokeStyle = g;
        c.lineWidth = width;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + ux * len * 0.5, y + uy * len * 0.5, tx, ty);
        c.stroke();
      }
      const head = c.createRadialGradient(x, y, 0, x, y, r * 2.6);
      head.addColorStop(0, '#ffffff');
      head.addColorStop(0.35, COLOUR);
      head.addColorStop(1, 'rgba(159, 232, 255, 0)');
      c.globalAlpha = flicker;
      c.fillStyle = head;
      c.beginPath();
      c.arc(x, y, r * 2.6, 0, Math.PI * 2);
      c.fill();
      if (this.selected === k.comet) {
        c.globalAlpha = 0.9;
        c.strokeStyle = '#ffffff';
        c.lineWidth = 1.2;
        c.setLineDash([3, 4]);
        c.beginPath();
        c.arc(x, y, r * 2.6 + 8, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
      }
    }
    c.restore();
  }

  labels(ctx: CanvasRenderingContext2D, f: SkyFrame): void {
    if (!this.on(f) || f.camera.current.scale < 0.55) return;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = '500 10px "IBM Plex Mono", monospace';
    ctx.fillStyle = COLOUR;
    ctx.globalAlpha = 0.75;
    for (const { comet, x, y } of this.onScreen)
      ctx.fillText(`#${comet.comet.issue}`, x + 8, y - 6);
    ctx.restore();
  }

  /** The comet nearest a screen point, within reach. */
  pick(sx: number, sy: number): T | null {
    let best: T | null = null;
    let bestD = Infinity;
    for (const { comet, x, y } of this.onScreen) {
      const d = Math.hypot(x - sx, y - sy);
      if (d < PICK_REACH && d < bestD) {
        best = comet.comet;
        bestD = d;
      }
    }
    return best;
  }
}
