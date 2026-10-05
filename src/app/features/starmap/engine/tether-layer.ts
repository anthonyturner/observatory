import { SkyFrame, SkyLayer } from './sky-frame';

/** What an open window is tied to: the ringed star, or the ringed comet. */
export type TetherTarget = 'star' | 'comet';

/** A window's box on screen, in the canvas's pixels. */
export interface TetherBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const COLOUR = '#cfeaff';

/** Where on a window's edge the line leaves for a point: the nearest, or none while the point is under it. */
export function edgeToward(box: TetherBox, x: number, y: number): [number, number] | null {
  const inside = x > box.left && x < box.right && y > box.top && y < box.bottom;
  if (inside) return null;
  return [Math.min(Math.max(x, box.left), box.right), Math.min(Math.max(y, box.top), box.bottom)];
}

/**
 * The line from an open PR screen or issue window to its star, drawn flat over
 * both renderers. A star off the canvas still gets a line that runs off its edge.
 */
export class TetherLayer implements SkyLayer {
  target: TetherTarget | null = null;

  constructor(
    private readonly window: () => TetherBox | null,
    private readonly cometAt: () => readonly [number, number] | null,
  ) {}

  flat(ctx: CanvasRenderingContext2D, f: SkyFrame): void {
    const to = this.targetAt(f);
    const box = to && this.window();
    const from = box && edgeToward(box, to[0], to[1]);
    if (!to || !from) return;
    ctx.save();
    ctx.strokeStyle = COLOUR;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.65;
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = f.frozen ? 0 : -f.t * 18;
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = COLOUR;
    ctx.beginPath();
    ctx.arc(from[0], from[1], 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private targetAt(f: SkyFrame): readonly [number, number] | null {
    if (this.target === 'comet') return this.cometAt();
    const star = this.target === 'star' ? f.selected : null;
    return star ? f.toScreen(star.ax, star.ay, star.az) : null;
  }
}
