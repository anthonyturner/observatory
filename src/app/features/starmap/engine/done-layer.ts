import { DoneItem, DoneKind, isPull } from '../../../core/queue/done-work';
import { DONE_OUTER, DonePlace, placeDone } from './done-spiral';
import { armAngle, galaxyToScreen, galaxyUniforms, galaxyView } from './galaxy-geometry';
import { SkyFrame, SkyLayer } from './sky-frame';

/* The Spiral of Done: finished pull requests and issues as lights on the
   review queue's galaxy, newest at the arm tips. They spiral in from beyond
   the tips when the sky opens, the last day's work pulses, and a light under
   the pointer, or lit from the Done list, says what it was. */

/** What a click on a light hands the sky, so it can tell it from a comet. */
export interface DoneHit {
  readonly done: DoneItem;
}

export const isDoneHit = (thing: unknown): thing is DoneHit =>
  typeof thing === 'object' && thing !== null && 'done' in thing;

/** Each kind's light: merged burns blue-white, a closed pull request is an
 *  ember, a completed issue gold, and one dropped a grey speck. */
const LOOK: Readonly<Record<DoneKind, { colour: string; size: number; alpha: number }>> = {
  merged: { colour: '#bfe0ff', size: 1.9, alpha: 0.95 },
  closed: { colour: '#e08a6a', size: 1.4, alpha: 0.6 },
  issue: { colour: '#ffd27a', size: 1.5, alpha: 0.9 },
  dropped: { colour: '#9aa0ad', size: 1.1, alpha: 0.5 },
};

const VERB: Readonly<Record<DoneKind, string>> = {
  merged: 'merged',
  closed: 'closed unmerged',
  issue: 'issue closed',
  dropped: 'issue dropped',
};

/** Seconds a light takes to spiral in, and the most any one waits its turn. */
const ARRIVE_S = 2.4;
const MAX_WAIT_S = 1.8;
const WAIT_PER_RANK_S = 0.012;
/** Lights start this far beyond the arm tips. */
const ARRIVE_FROM = DONE_OUTER * 1.7;
/** The newest few things finished within the last day pulse; more would be noise. */
const FRESH_MS = 86_400_000;
const FRESH_MAX = 6;
/** How near the pointer must be, in pixels, to be on a light. */
const HIT_PX = 9;
const TITLE_MAX = 54;
/** How bright a light the Done list's filter leaves out stays. */
const MUTED = 0.15;

interface Drawn {
  readonly place: DonePlace;
  readonly x: number;
  readonly y: number;
}

export class DoneLayer implements SkyLayer {
  /** The key the Done list has lit, if any. */
  lit: string | null = null;
  /** The one kind the Done list shows; the rest dim and cannot be picked. */
  only: DoneKind | null = null;
  /** How much of the right edge a panel covers, so labels stay clear of it. */
  clearRight = 0;
  private places: DonePlace[] = [];
  private drawn: Drawn[] = [];
  private hovered: string | null = null;
  private fresh = new Set<string>();
  /** When the sky first drew each light, so it arrives once. */
  private readonly bornAt = new Map<string, number>();

  /** The finished work to show, as of `now`. */
  set(items: readonly DoneItem[], now: number): void {
    this.places = placeDone(items, now);
    this.fresh = new Set(
      [...items]
        .filter((item) => now - item.at < FRESH_MS)
        .sort((a, b) => b.at - a.at)
        .slice(0, FRESH_MAX)
        .map((item) => item.key),
    );
  }

  /** Marks the light at a point as under the pointer; true when that changed. */
  hoverOn(item: DoneItem | null): boolean {
    const key = item?.key ?? null;
    if (key === this.hovered) return false;
    this.hovered = key;
    return true;
  }

  pick(sx: number, sy: number): DoneHit | null {
    let best: Drawn | null = null;
    let bestDistance = HIT_PX;
    for (const drawn of this.drawn) {
      const distance = Math.hypot(drawn.x - sx, drawn.y - sy);
      if (distance < bestDistance) [best, bestDistance] = [drawn, distance];
    }
    return best ? { done: best.place.item } : null;
  }

  flat(ctx: CanvasRenderingContext2D, f: SkyFrame): void {
    this.drawn = [];
    if (f.chart !== 'prs' || !this.places.length) return;
    const view = galaxyView(f);
    const { spin } = galaxyUniforms(view);
    for (const place of this.places) {
      const born = this.bornAt.get(place.item.key) ?? f.wall;
      this.bornAt.set(place.item.key, born);
      const wait = Math.min(place.rank * WAIT_PER_RANK_S, MAX_WAIT_S);
      const progress = f.frozen ? 1 : clamp((f.wall - born - wait) / ARRIVE_S);
      if (progress <= 0) continue;
      // Falling in along its arm: the radius closes and the angle follows the spiral.
      const eased = 1 - Math.pow(1 - progress, 3);
      const r = ARRIVE_FROM + (place.r - ARRIVE_FROM) * eased;
      const [x, y] = galaxyToScreen(r, armAngle(r, place.arm, spin) + place.lean, view);
      if (x < -20 || y < -20 || x > f.width + 20 || y > f.height + 20) continue;
      const isMuted = this.only !== null && place.item.kind !== this.only;
      if (!isMuted) this.drawn.push({ place, x, y });
      this.drawLight(ctx, place, x, y, eased, f, isMuted ? MUTED : 1);
    }
    const shown = this.drawn.find((d) => d.place.item.key === (this.hovered ?? this.lit));
    if (shown) this.drawLabel(ctx, shown, f);
  }

  private drawLight(
    ctx: CanvasRenderingContext2D,
    place: DonePlace,
    x: number,
    y: number,
    arrived: number,
    f: SkyFrame,
    brightness: number,
  ): void {
    const look = LOOK[place.item.kind];
    const key = place.item.key;
    const isOn = key === this.hovered || key === this.lit;
    const size = look.size * (isOn ? 1.6 : 1);
    ctx.save();
    ctx.globalAlpha = look.alpha * (0.4 + 0.6 * arrived) * brightness;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
    glow.addColorStop(0, look.colour);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, size * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.colour;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    // The last day's work breathes, so what just landed is easy to find.
    if (!f.frozen && brightness === 1 && this.fresh.has(key)) {
      const phase = (f.t * 0.5 + place.lean) % 1;
      ctx.globalAlpha = look.alpha * (1 - phase) * 0.5;
      ctx.strokeStyle = look.colour;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, size + 2 + phase * 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (isOn) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, size + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawLabel(ctx: CanvasRenderingContext2D, { place, x, y }: Drawn, f: SkyFrame): void {
    const { item } = place;
    const title =
      item.title.length > TITLE_MAX ? `${item.title.slice(0, TITLE_MAX - 1)}…` : item.title;
    const when = new Date(item.at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    const head = `${isPull(item) ? '#' : 'issue '}${item.number} · ${VERB[item.kind]} ${when}`;
    ctx.save();
    ctx.font = '500 11px "IBM Plex Mono", monospace';
    const headWidth = ctx.measureText(head).width;
    ctx.font = '400 12px "IBM Plex Sans", sans-serif';
    const width = Math.max(headWidth, ctx.measureText(title).width) + 20;
    const left = labelLeft(x, width, f.width - this.clearRight);
    const top = Math.min(Math.max(y - 46, 8), f.height - 52);
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(8, 12, 28, 0.86)';
    ctx.strokeStyle = LOOK[item.kind].colour;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(left, top, width, 44, 8);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = LOOK[item.kind].colour;
    ctx.font = '500 11px "IBM Plex Mono", monospace';
    ctx.fillText(head, left + 10, top + 17);
    ctx.fillStyle = '#eaf0ff';
    ctx.font = '400 12px "IBM Plex Sans", sans-serif';
    ctx.fillText(title, left + 10, top + 34);
    ctx.restore();
  }
}

const clamp = (value: number): number => Math.min(Math.max(value, 0), 1);

/** Where a label `width` wide starts beside a light at `x`: toward the middle
 *  of the clear sky `clearWidth` wide (the screen less any panel on its right
 *  edge), and kept inside it either way. */
export function labelLeft(x: number, width: number, clearWidth: number): number {
  const beside = x > clearWidth / 2 ? x - 14 - width : x + 14;
  return Math.min(Math.max(beside, 8), clearWidth - width - 8);
}
