import { ORBIT_SQUASH } from '../../../core/orrery/orbit';
import { OrreryWorld } from '../../../core/orrery/world-layout';
import { OrreryPalette, rgba } from './orrery-palette';

/** A world as it stands this frame, in screen pixels. */
export interface PlacedWorld {
  readonly world: OrreryWorld;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** 0 to 1 as it grows in. */
  readonly grow: number;
  /** Its severity colour as an `r, g, b` triple. */
  readonly color: string;
  /** Toward the sun, in radians: the side it is lit from. */
  readonly sunward: number;
  readonly isSelected: boolean;
}

/** A world is never smaller than this on screen. */
export const MIN_WORLD_RADIUS = 3.4;
/** Below this zoom the names are too small to read. */
const LABEL_MIN_SCALE = 0.2;
const LABEL_MIN_GROWTH = 0.6;

export function paintOrbit(
  ctx: CanvasRenderingContext2D,
  centre: readonly [number, number],
  placed: PlacedWorld,
  scale: number,
  palette: OrreryPalette,
): void {
  if (placed.grow <= 0) return;
  const { world, isSelected } = placed;
  ctx.save();
  ctx.globalAlpha = (isSelected ? 0.55 : 0.18) * placed.grow;
  ctx.strokeStyle = rgba(isSelected ? placed.color : palette.orbit);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(
    centre[0],
    centre[1],
    world.orbit * scale,
    world.orbit * (ORBIT_SQUASH + world.tilt) * scale,
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();
}

/** The world into the glow layer: its halo, a body lit from the sun, and its marks. */
export function paintWorld(
  c: CanvasRenderingContext2D,
  placed: PlacedWorld,
  time: number,
  isStill: boolean,
  palette: OrreryPalette,
): void {
  if (placed.grow <= 0) return;
  const { x, y, radius: r, color, sunward } = placed;
  c.save();

  const halo = c.createRadialGradient(x, y, 0, x, y, r * 3.4);
  halo.addColorStop(0, rgba(color));
  halo.addColorStop(0.3, rgba(color, 0.44));
  halo.addColorStop(1, rgba(color, 0));
  c.globalAlpha = 0.42;
  c.fillStyle = halo;
  c.beginPath();
  c.arc(x, y, r * 3.4, 0, Math.PI * 2);
  c.fill();

  // One light source for the whole system: the sun.
  c.globalAlpha = 1;
  const lit = c.createRadialGradient(
    x + Math.cos(sunward) * r * 0.48,
    y + Math.sin(sunward) * r * 0.48,
    r * 0.1,
    x,
    y,
    r,
  );
  lit.addColorStop(0, rgba(palette.worldLight));
  lit.addColorStop(0.35, rgba(color));
  lit.addColorStop(1, rgba(palette.worldShade));
  c.fillStyle = lit;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();

  // A rim of scattered light along the sunward limb.
  c.globalAlpha = 0.85;
  c.strokeStyle = rgba(color);
  c.lineWidth = Math.max(r * 0.09, 0.7);
  c.beginPath();
  c.arc(x, y, r * 0.97, sunward - 1.25, sunward + 1.25);
  c.stroke();

  if (placed.world.hasRing) paintRing(c, placed);
  paintMoons(c, placed, time, palette);
  paintComets(c, placed, time, isStill, palette);
  if (placed.isSelected) paintSelection(c, placed, time, palette);
  c.restore();
}

/** A ring means branches that no longer merge. */
function paintRing(
  c: CanvasRenderingContext2D,
  { x, y, radius: r, color, world }: PlacedWorld,
): void {
  c.lineWidth = Math.max(r * 0.12, 1);
  c.strokeStyle = rgba(color);
  for (const [rx, ry, alpha] of [
    [1.95, 0.56, 0.8],
    [2.25, 0.66, 0.4],
  ] as const) {
    c.globalAlpha = alpha;
    c.beginPath();
    c.ellipse(x, y, r * rx, r * ry, world.tilt + world.spin * 0.14, 0, Math.PI * 2);
    c.stroke();
  }
}

/** One moon per blocked pull request. */
function paintMoons(
  c: CanvasRenderingContext2D,
  placed: PlacedWorld,
  time: number,
  palette: OrreryPalette,
): void {
  const { x, y, radius: r, world } = placed;
  c.globalAlpha = 0.9;
  c.fillStyle = rgba(palette.moon);
  for (let moon = 0; moon < world.moons; moon++) {
    const angle = world.spin + time * (0.5 + moon * 0.16) + (moon / world.moons) * Math.PI * 2;
    const distance = r * 2.7 + moon * r * 0.34;
    c.beginPath();
    c.arc(
      x + Math.cos(angle) * distance,
      y + Math.sin(angle) * distance * 0.48,
      Math.max(r * 0.15, 1.3),
      0,
      Math.PI * 2,
    );
    c.fill();
  }
}

/** Comets: unclaimed issues, each tail streaming away from its world. */
function paintComets(
  c: CanvasRenderingContext2D,
  placed: PlacedWorld,
  time: number,
  isStill: boolean,
  palette: OrreryPalette,
): void {
  const { x, y, radius: r, world } = placed;
  for (let comet = 0; comet < world.comets; comet++) {
    const angle =
      world.spin * 2 +
      (isStill ? 0 : time * (0.09 + comet * 0.03)) +
      (comet / world.comets) * Math.PI * 2;
    const distance = r * (4.4 + comet * 0.5);
    const hx = x + Math.cos(angle) * distance;
    const hy = y + Math.sin(angle) * distance * 0.55;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle) * 0.55;
    const length = r * 1.8;
    const tail = c.createLinearGradient(hx, hy, hx + ux * length, hy + uy * length);
    tail.addColorStop(0, rgba(palette.comet));
    tail.addColorStop(1, rgba(palette.comet, 0));
    c.globalAlpha = 0.8;
    c.strokeStyle = tail;
    c.lineWidth = Math.max(r * 0.08, 1);
    c.beginPath();
    c.moveTo(hx, hy);
    c.lineTo(hx + ux * length, hy + uy * length);
    c.stroke();
    c.fillStyle = rgba(palette.cometHead);
    c.beginPath();
    c.arc(hx, hy, Math.max(r * 0.1, 1.2), 0, Math.PI * 2);
    c.fill();
  }
}

/** A turning dashed ring with four ticks round the chosen world. */
function paintSelection(
  c: CanvasRenderingContext2D,
  placed: PlacedWorld,
  time: number,
  palette: OrreryPalette,
): void {
  const { x, y, radius: r } = placed;
  const ring = r * 1.45 + 10;
  c.globalAlpha = 0.95;
  c.strokeStyle = rgba(palette.select);
  c.lineWidth = 1.4;
  c.setLineDash([4, 5]);
  c.lineDashOffset = -time * 22;
  c.beginPath();
  c.arc(x, y, ring, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);
  c.globalAlpha = 0.7;
  c.beginPath();
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    c.moveTo(x + dx * (ring + 3), y + dy * (ring + 3));
    c.lineTo(x + dx * (ring + 9), y + dy * (ring + 9));
  }
  c.stroke();
}

/** The name under the world, and "N open · Nd" under that. */
export function paintWorldLabel(
  ctx: CanvasRenderingContext2D,
  placed: PlacedWorld,
  scale: number,
  palette: OrreryPalette,
): void {
  if (scale < LABEL_MIN_SCALE || placed.grow < LABEL_MIN_GROWTH) return;
  const { x, y, radius: r, world, grow } = placed;
  const { project } = world;
  const baseline = y + r * 1.55 + 18;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.95 * grow;
  ctx.fillStyle = rgba(palette.ink);
  ctx.font = `500 12.5px ${palette.fontSans}`;
  ctx.fillText(project.name, x, baseline);
  ctx.globalAlpha = 0.55 * grow;
  ctx.fillStyle = rgba(palette.muted);
  ctx.font = `500 10.5px ${palette.fontMono}`;
  const detail = project.error
    ? 'unreadable'
    : `${project.open} open · ${project.oldestIdleDays ?? 0}d`;
  ctx.fillText(detail, x, baseline + 14);
  ctx.restore();
}
