import { SATELLITE_RHYTHM, Satellite, SatelliteState } from '../../../core/live-agents/satellites';
import { hashString } from '../../../core/orrery/world-layout';
import { dopplerOf, listenerOf } from '../sound/doppler';
import { starRadius } from './canvas-sky';
import { labelLeft } from './done-layer';
import { SkyFrame, SkyLayer } from './sky-frame';
import { SkyStar } from './sky-model';

/** Radians a second round the star, against the crew ship's direction; where a still sky parks it. */
const ORBIT_SPEED = -0.32;
const STILL_ANGLE = (3 * Math.PI) / 4;
/** Outside the crew ship's orbit (4.4 × the star's radius), tilted the other way. */
const ORBIT_REACH = 5.6;
const ORBIT_MIN_PX = 26;
const ORBIT_MAX_PX = 96;
const ORBIT_TILT = -0.4;
/** Each extra satellite at one star flies a little wider. */
const LANE_STEP = 0.2;

/** The parking orbit: a slim ellipse across the top of the free sky. */
const PARK_RX_SHARE = 0.4;
const PARK_RY_PX = 9;
const PARK_DROP_PX = 14;
const PARK_SPEED = -0.045;

/** The light shows for this share of each blink. */
const BLINK_ON_SHARE = 0.22;
const HIT_PX = 14;
const NAME_MAX = 48;

const BODY = '#c9d3e8';
const PANEL = '#4a78c8';
const EDGE = '#1c2742';
const LIGHT: Readonly<Record<SatelliteState, string>> = {
  working: '#7ef0b8',
  waiting: '#ffb347',
  quiet: '#8aa0c8',
};

/** Which of the satellites sharing one orbit this is. */
export interface Lane {
  readonly index: number;
  readonly count: number;
}

/** Each satellite's lane among those orbiting the same host: a pull request's star, or null for the parking orbit. */
export function lanesOf(
  placed: readonly { key: string; host: number | null }[],
): Map<string, Lane> {
  const groups = new Map<number | null, string[]>();
  for (const { key, host } of placed) groups.set(host, [...(groups.get(host) ?? []), key]);
  const lanes = new Map<string, Lane>();
  for (const keys of groups.values()) {
    keys.forEach((key, index) => lanes.set(key, { index, count: keys.length }));
  }
  return lanes;
}

/** Where a satellite is relative to its star. */
export function orbitOffset(
  lane: Lane,
  orbit: number,
  t: number,
  frozen: boolean,
): { dx: number; dy: number } {
  const angle = (frozen ? STILL_ANGLE : t * ORBIT_SPEED) + (lane.index / lane.count) * Math.PI * 2;
  const reach = orbit * (1 + LANE_STEP * lane.index);
  return { dx: Math.cos(angle) * reach, dy: Math.sin(angle) * reach * ORBIT_TILT };
}

/** Where a parked satellite is: spread round a slim ellipse under the top of the free sky. */
export function parkingPoint(
  lane: Lane,
  clear: { width: number; top: number },
  t: number,
  frozen: boolean,
): { x: number; y: number } {
  const angle = (frozen ? 0 : t * PARK_SPEED) + (lane.index / lane.count) * Math.PI * 2;
  return {
    x: clear.width / 2 + Math.cos(angle) * clear.width * PARK_RX_SHARE,
    y: clear.top + PARK_DROP_PX + Math.sin(angle) * PARK_RY_PX,
  };
}

/** Whether a satellite's light is lit now. It blinks at its state's rate, each
 *  on its own phase (`seed`), and stays steadily lit when motion is off. */
export function isLit(state: SatelliteState, t: number, frozen: boolean, seed: number): boolean {
  if (frozen) return true;
  const period = SATELLITE_RHYTHM[state].blinkMs;
  return (t * 1000 + seed) % period < period * BLINK_ON_SHARE;
}

/** Where the free sky is: how much of the right edge a panel covers, and where it starts below the chrome. */
export interface ClearSky {
  readonly side: number;
  readonly top: number;
}

interface Drawn {
  readonly mark: Satellite;
  readonly x: number;
  readonly y: number;
  /** The Doppler factor of its motion since the frame before. */
  readonly doppler: number;
}

/** Where a satellite was drawn, and when, on the scene's clock. */
interface Seen {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

/** What a satellite sounds like to the viewer right now. */
export interface Heard {
  /** -1 left to 1 right. */
  readonly pan: number;
  /** Above 1 on the side of its orbit coming toward you, below 1 going away. */
  readonly doppler: number;
}

/** A frame this far after the last is a stall, not motion. */
const MAX_STEP_S = 0.25;

/**
 * The live agents' satellites: each a small marker, flat over both renderers,
 * orbiting its pull request's star or parked along the top of the sky. Its
 * light blinks at a rate set by the agent's state. A still sky parks them and
 * holds the light steady. What it sounds like follows what it drew: panned by
 * where it is, shifted by how fast it moved toward or away from the viewer.
 */
export class SatelliteLayer implements SkyLayer {
  private marks: readonly Satellite[] = [];
  private drawn: Drawn[] = [];
  private seen = new Map<string, Seen>();
  private width = 0;
  private hovered: string | null = null;

  constructor(private readonly clearSky: () => ClearSky) {}

  set(marks: readonly Satellite[]): void {
    this.marks = marks;
  }

  /** How a satellite sounds, from where and how it was last drawn; centred and unshifted when not drawn. */
  heardOf(key: string): Heard {
    const drawn = this.drawn.find((each) => each.mark.key === key);
    if (!drawn || !this.width) return { pan: 0, doppler: 1 };
    return {
      pan: Math.min(1, Math.max(-1, (drawn.x / this.width) * 2 - 1)),
      doppler: drawn.doppler,
    };
  }

  /** Marks the satellite under the pointer at `point` (null: off the sky); true when that changed. */
  hoverAt(point: { x: number; y: number } | null): boolean {
    const key = point ? (this.nearest(point)?.mark.key ?? null) : null;
    if (key === this.hovered) return false;
    this.hovered = key;
    return true;
  }

  /** Whether a satellite is under the pointer, as of the last `hoverAt`. */
  get isHovering(): boolean {
    return this.hovered !== null;
  }

  flat(ctx: CanvasRenderingContext2D, f: SkyFrame): void {
    const before = this.seen;
    this.drawn = [];
    this.seen = new Map();
    this.width = f.width;
    if (f.chart !== 'prs') return;
    const listener = listenerOf(f.width, f.height);
    const sky = this.clearSky();
    // A pull request with no star in this sky (dismissed, snoozed) leaves its agents parked.
    const placed = this.marks.map((mark) => ({
      mark,
      star: mark.pr === null ? undefined : f.stars.find((each) => each.item?.pr === mark.pr),
    }));
    const lanes = lanesOf(
      placed.map(({ mark, star }) => ({ key: mark.key, host: star ? mark.pr : null })),
    );
    for (const { mark, star } of placed) {
      const lane = lanes.get(mark.key) ?? { index: 0, count: 1 };
      const at = star
        ? this.aroundStar(f, star, lane)
        : parkingPoint(lane, { width: f.width - sky.side, top: sky.top }, f.t, f.frozen);
      // A still sky parks them, and a frame after a stall measures no motion.
      const last = before.get(mark.key);
      const doppler =
        f.frozen || !last || f.t - last.t > MAX_STEP_S
          ? 1
          : dopplerOf({ ...last, z: 0 }, { ...at, z: 0 }, f.t - last.t, listener);
      this.seen.set(mark.key, { ...at, t: f.t });
      this.drawn.push({ mark, ...at, doppler });
      const lit = isLit(mark.state, f.t, f.frozen, hashString(mark.key));
      drawSatellite(ctx, at.x, at.y, mark.state, lit);
    }
  }

  labels(ctx: CanvasRenderingContext2D, f: SkyFrame): void {
    const shown = this.drawn.find((each) => each.mark.key === this.hovered);
    if (shown) drawLabel(ctx, shown, f.width - this.clearSky().side);
  }

  private nearest(point: { x: number; y: number }): Drawn | null {
    let best: Drawn | null = null;
    let bestDistance = HIT_PX;
    for (const drawn of this.drawn) {
      const distance = Math.hypot(drawn.x - point.x, drawn.y - point.y);
      if (distance < bestDistance) [best, bestDistance] = [drawn, distance];
    }
    return best;
  }

  private aroundStar(f: SkyFrame, star: SkyStar, lane: Lane): { x: number; y: number } {
    const orbit = Math.min(
      Math.max(starRadius(f, star, 1) * ORBIT_REACH, ORBIT_MIN_PX),
      ORBIT_MAX_PX,
    );
    const [x, y] = f.toScreen(star.ax, star.ay, star.az);
    const offset = orbitOffset(lane, orbit, f.t, f.frozen);
    return { x: x + offset.dx, y: y + offset.dy };
  }
}

function drawSatellite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: SatelliteState,
  lit: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = PANEL;
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 0.6;
  for (const panelLeft of [-9, 3.2]) {
    ctx.beginPath();
    ctx.rect(panelLeft, -1.6, 5.8, 3.2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = BODY;
  ctx.beginPath();
  ctx.rect(-3.2, -2.2, 6.4, 4.4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = lit ? LIGHT[state] : EDGE;
  ctx.beginPath();
  ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
  ctx.fill();
  if (lit) {
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 7);
    glow.addColorStop(0, LIGHT[state]);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, { mark, x, y }: Drawn, clearWidth: number): void {
  const name = mark.name.length > NAME_MAX ? `${mark.name.slice(0, NAME_MAX - 1)}…` : mark.name;
  ctx.save();
  ctx.font = '400 12px "IBM Plex Sans", sans-serif';
  const width = Math.max(ctx.measureText(name).width, ctx.measureText(mark.stateText).width) + 20;
  const left = labelLeft(x, width, clearWidth);
  const top = Math.max(y + 12, 8);
  ctx.fillStyle = 'rgba(8, 12, 28, 0.86)';
  ctx.strokeStyle = LIGHT[mark.state];
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(left, top, width, 40, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = LIGHT[mark.state];
  ctx.font = '500 11px "IBM Plex Mono", monospace';
  ctx.fillText(mark.stateText, left + 10, top + 16);
  ctx.fillStyle = '#eaf0ff';
  ctx.font = '400 12px "IBM Plex Sans", sans-serif';
  ctx.fillText(name, left + 10, top + 31);
  ctx.restore();
}
