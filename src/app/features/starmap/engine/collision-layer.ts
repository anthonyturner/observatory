import { SkyFrame, SkyLayer } from './sky-frame';
import { SkyStar } from './sky-model';

/**
 * A pair of open pull requests that share a file. `conflict` is `true` when git
 * failed to merge them, `null` when they were not checked, `false` when they
 * merge cleanly. Unknown is never drawn as safe, and safe never as a threat.
 */
export interface SkyPair {
  readonly a: number;
  readonly b: number;
  readonly conflict: boolean | null;
  readonly conflictFiles?: readonly string[];
  readonly sharedCount?: number;
}

interface PairStyle {
  readonly colour: string;
  readonly alpha: number;
  readonly dash: number[];
  readonly word: string;
}

export const COLLIDE: Readonly<Record<'true' | 'null' | 'false', PairStyle>> = {
  true: { colour: '#ff6f5e', alpha: 0.75, dash: [9, 7], word: 'would conflict' },
  null: { colour: '#c08cff', alpha: 0.4, dash: [2, 6], word: 'shares files, not checked' },
  false: { colour: '#6f8cff', alpha: 0.35, dash: [1, 5], word: 'shares files, merges cleanly' },
};

const BOW = 0.18;

/** Pull request number → its star, for the stars on screen. */
export const starsByPr = (stars: readonly SkyStar[]): Map<number, SkyStar> =>
  new Map(stars.filter((s) => s.item).map((s) => [s.item?.pr as number, s]));

/** A shallow arc between two stars, bowed to one side so crossing threads stay distinct. */
export function arcBetween(f: SkyFrame, sa: SkyStar, sb: SkyStar) {
  const [x0, y0] = f.toScreen(sa.ax, sa.ay, sa.az);
  const [x1, y1] = f.toScreen(sb.ax, sb.ay, sb.az);
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  return { x0, y0, x1, y1, qx: mx - (y1 - y0) * BOW, qy: my + (x1 - x0) * BOW };
}

/** Collision threads: every real conflict while Collisions is on, anything
 *  short of one only around the star in focus. */
export class CollisionLayer implements SkyLayer {
  pairs: readonly SkyPair[] = [];
  showCollisions = true;

  livePairs(f: SkyFrame): SkyPair[] {
    if (f.chart !== 'prs') return [];
    const byPr = starsByPr(f.stars);
    const focus = f.selected?.item?.pr;
    return this.pairs.filter(
      (p) =>
        byPr.has(p.a) &&
        byPr.has(p.b) &&
        (p.conflict === true
          ? this.showCollisions || focus === p.a || focus === p.b
          : focus === p.a || focus === p.b),
    );
  }

  beneath(c: CanvasRenderingContext2D, f: SkyFrame): void {
    const pairs = this.livePairs(f);
    if (!pairs.length) return;
    const byPr = starsByPr(f.stars);
    const focus = f.selected?.item?.pr;
    const { t } = f;
    c.save();
    for (const p of pairs) {
      const style = COLLIDE[String(p.conflict) as keyof typeof COLLIDE];
      const k = arcBetween(f, byPr.get(p.a) as SkyStar, byPr.get(p.b) as SkyStar);
      const dimmed = focus && focus !== p.a && focus !== p.b;
      const weight = 1 + Math.log2((p.conflictFiles?.length ?? p.sharedCount ?? 1) + 1) * 0.9;
      c.globalAlpha = style.alpha * (dimmed ? 0.3 : 1);
      c.strokeStyle = style.colour;
      c.lineWidth = weight;
      c.setLineDash(style.dash);
      c.lineDashOffset = f.frozen ? 0 : -t * 24;
      c.beginPath();
      c.moveTo(k.x0, k.y0);
      c.quadraticCurveTo(k.qx, k.qy, k.x1, k.y1);
      c.stroke();
      if (p.conflict !== true) continue;
      // The spark: where the two courses meet, a small star of its own that
      // flares and settles, so a collision reads as an event, not a line.
      const sx = 0.25 * k.x0 + 0.5 * k.qx + 0.25 * k.x1;
      const sy = 0.25 * k.y0 + 0.5 * k.qy + 0.25 * k.y1;
      const pulse = f.frozen ? 0.8 : 0.6 + Math.sin(t * 3.1 + p.a * 0.7) * 0.4;
      const r = (3 + weight) * pulse;
      c.setLineDash([]);
      c.globalAlpha = (dimmed ? 0.3 : 0.95) * pulse;
      c.strokeStyle = '#ffd2c8';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(sx - r * 2, sy);
      c.lineTo(sx + r * 2, sy);
      c.moveTo(sx, sy - r * 2);
      c.lineTo(sx, sy + r * 2);
      c.stroke();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(sx, sy, r * 0.45, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
}
