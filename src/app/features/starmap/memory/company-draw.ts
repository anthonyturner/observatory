import { PLANET_TONES } from '../engine/star-system';
import { SkyFrame } from '../engine/sky-frame';
import {
  GHOST_COLOUR,
  MeteorPull,
  PlanetPose,
  RESOLVED_GREEN,
  ghostLook,
  meteorPull,
  planetOffset,
  planetPoses,
} from './departure-company';
import { PRELUDE_S } from './departure-exit';
import { NewsEvent } from './news';

/* A leaving star's company in Canvas 2D: its last light, the planets turning
   green and drifting off or falling, and the meteor pulled into the core. It is
   drawn flat, the way the crew ships and the meteors are, so the 3D sky shows
   the same picture over its scene and the two cannot disagree. */

/** The mark a departed star is drawn at: where it stood on screen, and the size it is drawn at. */
export interface Departed {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

/** A planet is never drawn smaller than this many pixels across. */
const MIN_PLANET_PX = 1.6;

const HEAD = '255, 244, 214';
const EMBER = '255, 170, 90';

const channels = (hex: string): string =>
  [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(', ');

/** A colour `share` (0 to 1) of the way from one hex colour to another. */
export function mixColour(from: string, towards: string, share: number): string {
  const channels = (hex: string): number[] =>
    [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  const [a, b] = [channels(from), channels(towards)];
  const k = Math.min(1, Math.max(0, share));
  return `#${a
    .map((c, i) =>
      Math.round(c + (b[i] - c) * k)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

const rgba = (hex: string, alpha: number): string => `rgba(${channels(hex)}, ${alpha})`;

/** The star's last light: a soft halo and a core. */
function ghost(
  c: CanvasRenderingContext2D,
  { x, y, size }: Departed,
  look: ReturnType<typeof ghostLook>,
): void {
  const reach = size * look.radius * 2.4;
  const halo = c.createRadialGradient(x, y, 0, x, y, reach);
  halo.addColorStop(0, rgba(GHOST_COLOUR, 0.55 * look.alpha));
  halo.addColorStop(1, rgba(GHOST_COLOUR, 0));
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = halo;
  c.beginPath();
  c.arc(x, y, reach, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = look.alpha;
  c.fillStyle = GHOST_COLOUR;
  c.beginPath();
  c.arc(x, y, size * look.radius * 0.7, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
}

/** A small world lit from the star: a halo while it glows green, a bright side toward the core. */
function planet(c: CanvasRenderingContext2D, star: Departed, pose: PlanetPose): void {
  const off = planetOffset(pose, star.size);
  const x = star.x + off.x;
  const y = star.y + off.y;
  const radius = Math.max(pose.size * star.size, MIN_PLANET_PX);
  const colour = mixColour(PLANET_TONES[pose.tone], RESOLVED_GREEN, pose.green);
  c.globalAlpha = pose.alpha;
  if (pose.green > 0) {
    const halo = c.createRadialGradient(x, y, 0, x, y, radius * 3.4);
    halo.addColorStop(0, rgba(RESOLVED_GREEN, 0.7 * pose.green));
    halo.addColorStop(1, rgba(RESOLVED_GREEN, 0));
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = halo;
    c.beginPath();
    c.arc(x, y, radius * 3.4, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = 'source-over';
  }
  const toward = Math.hypot(star.x - x, star.y - y) || 1;
  const lx = ((star.x - x) / toward) * radius * 0.45;
  const ly = ((star.y - y) / toward) * radius * 0.45;
  const body = c.createRadialGradient(x + lx, y + ly, 0, x, y, radius);
  body.addColorStop(0, mixColour(colour, '#ffffff', 0.55));
  body.addColorStop(1, mixColour(colour, '#000000', 0.55));
  c.fillStyle = body;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
}

/** The meteor on its way in, its tail trailing behind and shortening as it is drawn into the core. */
function meteor(c: CanvasRenderingContext2D, { x, y }: Departed, pull: MeteorPull): void {
  const { heading, distancePx, tailPx, brightness, p } = pull;
  const headX = x + heading.x * distancePx;
  const headY = y + heading.y * distancePx;
  const alpha = brightness * Math.min(1, p / 0.2);
  const tail = c.createLinearGradient(
    headX,
    headY,
    headX + heading.x * tailPx,
    headY + heading.y * tailPx,
  );
  tail.addColorStop(0, `rgba(${HEAD}, ${alpha})`);
  tail.addColorStop(1, `rgba(${EMBER}, 0)`);
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = tail;
  c.lineWidth = 1.6 + 1.4 * brightness;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(headX, headY);
  c.lineTo(headX + heading.x * tailPx, headY + heading.y * tailPx);
  c.stroke();
  c.fillStyle = `rgba(${HEAD}, ${alpha})`;
  c.beginPath();
  c.arc(headX, headY, 2 + 1.6 * brightness, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = 'source-over';
}

/**
 * What the star's company is doing at this moment of an exit's prelude, if it
 * is in it: the star's last light, then its planets and the meteor. With motion
 * off only the light and the planets that turn green show, in place.
 */
export function drawCompany(
  c: CanvasRenderingContext2D,
  f: SkyFrame,
  ev: NewsEvent,
  star: Departed,
): void {
  const { departure, startAt } = ev;
  if (!departure || startAt == null) return;
  const since = f.wall - startAt;
  if (since < 0 || since >= PRELUDE_S) return;
  c.save();
  ghost(c, star, ghostLook(departure, since));
  const poses = planetPoses(departure, since, f.frozen);
  // Those on the near side of the star are drawn last, over it and over those behind.
  poses
    .map((pose) => ({ pose, depth: planetOffset(pose, 1).z }))
    .sort((a, b) => a.depth - b.depth)
    .forEach(({ pose }) => planet(c, star, pose));
  const pull =
    departure.system.meteor && !f.frozen ? meteorPull(departure.system.meteor, since) : null;
  if (pull) meteor(c, star, pull);
  c.restore();
}
