import { DrawnWorld } from '../../../core/orrery/pick-world';
import { ShippedItem } from '../../../core/orrery/shipped';
import { SceneFrame } from './orrery-scene';
import { bandToScreen } from './milky-way-geometry';

/* The Milky Way made of what you shipped: every pull request merged in the
   last 60 days, across the projects on show, is a speck inside the band in
   its project's colour, oldest at one end and newest at the other. */

/** Where along the band the oldest and the newest sit, in sky units. */
const OLDEST_U = -0.85;
const NEWEST_U = 0.85;
/** How far across the band specks spread, either side of its centre line. */
const BAND_REACH = 0.08;
/** The band spans the work shown, but never less than a week. */
const MIN_SPAN_DAYS = 7;
/** Ages are eased so recent days get more of the band than old ones. */
const AGE_EASE = 0.7;
const DAY_MS = 86_400_000;
/** Seconds a speck takes to fade in, and the most any one waits its turn. */
const FADE_S = 1.4;
const MAX_WAIT_S = 1.6;
const WAIT_PER_RANK_S = 0.004;
/** How near the pointer must be, in pixels, to be on a speck. */
const HIT_PX = 8;
const TITLE_MAX = 56;

/** One shipped pull request, placed in the band. */
export interface ShippedPlace {
  readonly item: ShippedItem;
  /** Along the band, from its middle. */
  readonly u: number;
  /** Across it, from its centre line. */
  readonly v: number;
  /** Its order of arrival, oldest first. */
  readonly rank: number;
}

/** A stable number in [0, 1) from a key, so a speck keeps its place across reloads. */
function unit(key: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

/** Each shipped pull request along the band by when it merged, scattered
 *  across it, thickest at the centre line as a real band is. */
export function placeShipped(items: readonly ShippedItem[], now: number): ShippedPlace[] {
  const oldestFirst = [...items].sort((a, b) => a.at - b.at);
  const oldest = oldestFirst.length ? (now - oldestFirst[0].at) / DAY_MS : 0;
  const span = Math.max(oldest, MIN_SPAN_DAYS);
  return oldestFirst.map((item, rank) => {
    // Spread through its own day, so a busy day is a stretch of band, not a blob.
    const days = Math.min(Math.max((now - item.at) / DAY_MS, 0) + unit(item.key, 3) - 0.5, span);
    const age = Math.pow(Math.max(days, 0) / span, AGE_EASE);
    // Two draws summed lean toward the middle: a triangle, densest on the line.
    const across = (unit(item.key, 1) + unit(item.key, 2) - 1) * BAND_REACH;
    return { item, u: NEWEST_U + (OLDEST_U - NEWEST_U) * age, v: across, rank };
  });
}

interface Drawn {
  readonly place: ShippedPlace;
  readonly x: number;
  readonly y: number;
}

export class ShippedLayer {
  private places: ShippedPlace[] = [];
  private drawn: Drawn[] = [];
  private hovered: string | null = null;
  private readonly bornAt = new Map<string, number>();

  set(items: readonly ShippedItem[], now: number): void {
    this.places = placeShipped(items, now);
  }

  /** Marks the speck under the pointer; true when that changed. */
  hoverOn(item: ShippedItem | null): boolean {
    const key = item?.key ?? null;
    if (key === this.hovered) return false;
    this.hovered = key;
    return true;
  }

  pick(x: number, y: number): ShippedItem | null {
    let best: Drawn | null = null;
    let bestDistance = HIT_PX;
    for (const drawn of this.drawn) {
      const distance = Math.hypot(drawn.x - x, drawn.y - y);
      if (distance < bestDistance) [best, bestDistance] = [drawn, distance];
    }
    return best?.place.item ?? null;
  }

  /**
   * Draws the specks over the sky, leaving out any a world sits in front of.
   * `colourOf` gives a project's colour as `r, g, b`.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    frame: SceneFrame,
    wall: number,
    worlds: readonly DrawnWorld[],
    colourOf: (repo: string) => string,
  ): void {
    this.drawn = [];
    const sky = { view: frame.view, camera: frame.camera.current, time: frame.time };
    const { width, height } = frame.view;
    for (const place of this.places) {
      const born = this.bornAt.get(place.item.key) ?? wall;
      this.bornAt.set(place.item.key, born);
      const wait = Math.min(place.rank * WAIT_PER_RANK_S, MAX_WAIT_S);
      const shown = frame.isStill ? 1 : clamp((wall - born - wait) / FADE_S);
      if (shown <= 0) continue;
      const [x, y] = bandToScreen(place.u, place.v, sky);
      if (x < -10 || y < -10 || x > width + 10 || y > height + 10) continue;
      if (worlds.some((w) => Math.hypot(w.x - x, w.y - y) < w.radius + 3)) continue;
      this.drawn.push({ place, x, y });
      this.drawSpeck(ctx, x, y, colourOf(place.item.repo), shown, place.item.key === this.hovered);
    }
    const hovered = this.drawn.find((d) => d.place.item.key === this.hovered);
    if (hovered) this.drawLabel(ctx, hovered, frame, colourOf(hovered.place.item.repo));
  }

  private drawSpeck(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rgb: string,
    shown: number,
    isOn: boolean,
  ): void {
    const size = isOn ? 2 : 0.9;
    ctx.save();
    ctx.globalAlpha = 0.6 * shown;
    // A faint halo in the project's colour round a near-white core: a star, tinted.
    const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
    glow.addColorStop(0, `rgba(${rgb}, 0.7)`);
    glow.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, size * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mixWhite(rgb);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
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

  private drawLabel(
    ctx: CanvasRenderingContext2D,
    { place, x, y }: Drawn,
    frame: SceneFrame,
    rgb: string,
  ): void {
    const { item } = place;
    const project = item.repo.split('/').pop() ?? item.repo;
    const when = new Date(item.at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    const head = `${project} · #${item.number} · merged ${when}`;
    const title =
      item.title.length > TITLE_MAX ? `${item.title.slice(0, TITLE_MAX - 1)}…` : item.title;
    ctx.save();
    ctx.font = '500 11px "IBM Plex Mono", monospace';
    const headWidth = ctx.measureText(head).width;
    ctx.font = '400 12px "IBM Plex Sans", sans-serif';
    const width = Math.max(headWidth, ctx.measureText(title).width) + 20;
    const left = Math.min(Math.max(x + 14, 8), frame.view.width - width - 8);
    const top = Math.min(Math.max(y - 46, 8), frame.view.height - 52);
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(8, 12, 28, 0.86)';
    ctx.strokeStyle = `rgb(${rgb})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(left, top, width, 44, 8);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.font = '500 11px "IBM Plex Mono", monospace';
    ctx.fillText(head, left + 10, top + 17);
    ctx.fillStyle = '#eaf0ff';
    ctx.font = '400 12px "IBM Plex Sans", sans-serif';
    ctx.fillText(title, left + 10, top + 34);
    ctx.restore();
  }
}

const clamp = (value: number): number => Math.min(Math.max(value, 0), 1);

/** `r, g, b` halfway to white, as a CSS colour. */
function mixWhite(rgb: string): string {
  const [r, g, b] = rgb.split(',').map((part) => Number(part.trim()));
  const half = (channel: number) => Math.round((channel + 255) / 2);
  return `rgb(${half(r)}, ${half(g)}, ${half(b)})`;
}
