import { SkyFrame, SkyLayer } from './sky-frame';
import { SkyStar } from './sky-model';

/** Two or more pull requests that close the same issue. */
export interface Binary {
  readonly issue: number;
  readonly stars: readonly SkyStar[];
}

/** Issue number → the shown pull requests that close it, two or more. */
export function binaries(
  stars: readonly SkyStar[],
  closesOf: (star: SkyStar) => readonly number[],
): Binary[] {
  const by = new Map<number, SkyStar[]>();
  for (const s of stars) {
    for (const n of closesOf(s)) {
      const group = by.get(n) ?? [];
      group.push(s);
      by.set(n, group);
    }
  }
  return [...by].filter(([, ss]) => ss.length > 1).map(([issue, ss]) => ({ issue, stars: ss }));
}

const STRANDS: readonly [number, string][] = [
  [0, '#ffe7a8'],
  [Math.PI, '#a8d8ff'],
];

/**
 * Binary stars: a twisted pair of strands between each star of a binary and
 * the next, so it cannot be mistaken for a collision thread or the work order.
 * Merging both closes the issue once and leaves the other change orphaned.
 */
export class BinaryLayer implements SkyLayer {
  constructor(private readonly closesOf: (star: SkyStar) => readonly number[]) {}

  groups(f: SkyFrame): Binary[] {
    return f.chart === 'prs' ? binaries(f.stars, this.closesOf) : [];
  }

  beneath(c: CanvasRenderingContext2D, f: SkyFrame): void {
    const groups = this.groups(f);
    if (!groups.length) return;
    c.save();
    for (const g of groups) {
      for (let i = 0; i < g.stars.length - 1; i++) {
        const [x0, y0] = f.toScreen(g.stars[i].ax, g.stars[i].ay, g.stars[i].az);
        const [x1, y1] = f.toScreen(g.stars[i + 1].ax, g.stars[i + 1].ay, g.stars[i + 1].az);
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const nx = -(y1 - y0) / len;
        const ny = (x1 - x0) / len;
        const turns = Math.max(2, Math.round(len / 70));
        const spin = f.frozen ? 0 : f.t * 1.6;
        for (const [phase, colour] of STRANDS) {
          c.globalAlpha = 0.75;
          c.strokeStyle = colour;
          c.lineWidth = 1.3;
          c.beginPath();
          for (let k = 0; k <= 64; k++) {
            const u = k / 64;
            const amp = 6 * Math.sin(u * Math.PI);
            const w = Math.sin(u * turns * Math.PI * 2 + spin + phase) * amp;
            const x = x0 + (x1 - x0) * u + nx * w;
            const y = y0 + (y1 - y0) * u + ny * w;
            if (k) c.lineTo(x, y);
            else c.moveTo(x, y);
          }
          c.stroke();
        }
      }
    }
    c.restore();
  }

  labels(ctx: CanvasRenderingContext2D, f: SkyFrame): void {
    const groups = this.groups(f);
    if (!groups.length || f.camera.current.scale < 0.3) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '600 9.5px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#ffe7a8';
    ctx.globalAlpha = 0.9;
    for (const g of groups) {
      const [x0, y0] = f.toScreen(g.stars[0].ax, g.stars[0].ay, g.stars[0].az);
      const [x1, y1] = f.toScreen(g.stars[1].ax, g.stars[1].ay, g.stars[1].az);
      ctx.fillText(`BINARY · BOTH CLOSE #${g.issue}`, (x0 + x1) / 2, (y0 + y1) / 2 - 12);
    }
    ctx.restore();
  }
}
