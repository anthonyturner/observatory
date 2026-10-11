import { FLIGHT_S, LANDING_S, LAUNCH_LAG_S, flightAt } from '../../../core/orrery/merge-arrival';
import { DrawnWorld } from '../../../core/orrery/pick-world';
import { ShippedItem } from '../../../core/orrery/shipped';
import { SceneFrame } from './orrery-scene';
import { bandToScreen } from './milky-way-geometry';

/* The Milky Way made of what you shipped: every pull request merged in the
   last 60 days, across the projects on show, is a speck inside the band in
   its project's colour, oldest at one end and newest at the other. A merge
   seen as it happens flies in from its world instead of fading in. */

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
const SPECK_PX = 0.9;
const HOVERED_SPECK_PX = 2;
/** A merge whose speck cannot be placed in this long is given up on and shown plainly. */
const ARRIVAL_PATIENCE_S = 20;
/** How far the flight bows off the straight line, as a share of its length. */
const FLIGHT_BOW = 0.16;
/** The flying speck: its size, and the dots of its trail, this far apart in progress. */
const FLYING_SPECK_PX = 2.6;
const TRAIL_DOTS = 7;
const TRAIL_STEP = 0.035;
const TRAIL_SHRINK_PX = 0.25;

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

/** A speck that has just set off from its world, for the score to follow. */
export interface Launch {
  readonly repo: string;
  /** Screen x it leaves from and comes down at. */
  readonly fromX: number;
  readonly toX: number;
}

interface Flight {
  readonly repo: string;
  /** Wall seconds it sets off. */
  readonly startsAt: number;
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
  /** Merges announced as they happened, waiting for a world to fly from and a place in the
   *  band; the value is the wall second the wait began, once it has. */
  private readonly arriving = new Map<string, number | null>();
  private readonly flights = new Map<string, Flight>();
  /** When each speck that flew came down, for its landing ring. */
  private readonly landings = new Map<string, number>();

  set(items: readonly ShippedItem[], now: number): void {
    this.places = placeShipped(items, now);
    const kept = new Set(this.places.map((place) => place.item.key));
    for (const key of [...this.flights.keys()]) if (!kept.has(key)) this.flights.delete(key);
  }

  /** A pull request has just merged: its speck flies in from its world instead of fading in. */
  arrive(item: ShippedItem): void {
    this.arriving.set(item.key, null);
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
   * Draws the specks over the sky, leaving out any a world sits in front of, and
   * returns the flights that set off this frame. `colourOf` gives a project's
   * colour as `r, g, b`.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    frame: SceneFrame,
    wall: number,
    worlds: readonly DrawnWorld[],
    colourOf: (repo: string) => string,
  ): Launch[] {
    this.drawn = [];
    const launches: Launch[] = [];
    const sky = { view: frame.view, camera: frame.camera.current, time: frame.time };
    const { width, height } = frame.view;
    for (const place of this.places) {
      const { key, repo } = place.item;
      const [x, y] = bandToScreen(place.u, place.v, sky);
      const onScreen = x >= -10 && y >= -10 && x <= width + 10 && y <= height + 10;
      const home = worlds.find((world) => world.key === repo);
      if (this.arriving.has(key)) {
        this.arriving.delete(key);
        // With no motion, or no world or band place in view to fly between, it just appears.
        if (home && onScreen && !frame.isStill) {
          this.flights.set(key, { repo, startsAt: wall + LAUNCH_LAG_S });
          launches.push({ repo, fromX: home.x, toX: x });
        }
      }
      const flight = this.flights.get(key);
      if (flight) {
        const elapsed = wall - flight.startsAt;
        if (elapsed < FLIGHT_S) {
          if (elapsed >= 0 && home) this.drawFlight(ctx, home, [x, y], elapsed, colourOf(repo));
          continue;
        }
        this.flights.delete(key);
        this.landings.set(key, flight.startsAt + FLIGHT_S);
        // It was already in view: no fade-in on top of the flight.
        this.bornAt.set(key, wall - FADE_S - MAX_WAIT_S);
      }
      const born = this.bornAt.get(key) ?? wall;
      this.bornAt.set(key, born);
      const wait = Math.min(place.rank * WAIT_PER_RANK_S, MAX_WAIT_S);
      const shown = frame.isStill ? 1 : clamp((wall - born - wait) / FADE_S);
      if (shown <= 0 || !onScreen) continue;
      if (worlds.some((w) => Math.hypot(w.x - x, w.y - y) < w.radius + 3)) continue;
      this.drawn.push({ place, x, y });
      const isOn = key === this.hovered;
      this.drawSpeck(ctx, x, y, colourOf(repo), 0.6 * shown, isOn ? HOVERED_SPECK_PX : SPECK_PX);
      if (isOn) this.drawHoverRing(ctx, x, y);
      const landedAt = this.landings.get(key);
      if (landedAt !== undefined) this.drawLanding(ctx, x, y, colourOf(repo), wall - landedAt);
    }
    this.forgetStale(wall);
    const hovered = this.drawn.find((d) => d.place.item.key === this.hovered);
    if (hovered) this.drawLabel(ctx, hovered, frame, colourOf(hovered.place.item.repo));
    return launches;
  }

  /** Gives up on announced merges that never found a place, and on finished landings. */
  private forgetStale(wall: number): void {
    for (const [key, waitingSince] of this.arriving) {
      if (waitingSince === null) this.arriving.set(key, wall);
      else if (wall - waitingSince > ARRIVAL_PATIENCE_S) this.arriving.delete(key);
    }
    for (const [key, landedAt] of this.landings) {
      if (wall - landedAt > LANDING_S) this.landings.delete(key);
    }
  }

  /** The speck on its way: a bright head and a short trail, bowing off the straight line. */
  private drawFlight(
    ctx: CanvasRenderingContext2D,
    from: DrawnWorld,
    to: readonly [number, number],
    elapsed: number,
    rgb: string,
  ): void {
    const dx = to[0] - from.x;
    const dy = to[1] - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const progress = flightAt(elapsed);
    for (let dot = TRAIL_DOTS; dot >= 0; dot--) {
      const t = Math.max(progress - dot * TRAIL_STEP, 0);
      const bow = Math.sin(Math.PI * t) * FLIGHT_BOW * length;
      const x = from.x + dx * t - (dy / length) * bow;
      const y = from.y + dy * t + (dx / length) * bow;
      const fade = 1 - dot / (TRAIL_DOTS + 1);
      this.drawSpeck(ctx, x, y, rgb, fade, FLYING_SPECK_PX - dot * TRAIL_SHRINK_PX);
    }
  }

  /** A ring spreading from where the speck came down. */
  private drawLanding(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rgb: string,
    since: number,
  ): void {
    if (since < 0 || since > LANDING_S) return;
    const spread = since / LANDING_S;
    ctx.save();
    ctx.globalAlpha = 0.7 * (1 - spread);
    ctx.strokeStyle = `rgb(${rgb})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 3 + spread * 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawSpeck(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rgb: string,
    alpha: number,
    size: number,
  ): void {
    ctx.save();
    ctx.globalAlpha = alpha;
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
    ctx.restore();
  }

  private drawHoverRing(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, HOVERED_SPECK_PX + 5, 0, Math.PI * 2);
    ctx.stroke();
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
