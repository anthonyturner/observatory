import { OrreryCamera, Viewport } from '../../../core/orrery/orrery-camera';
import { FieldStar, twinkle } from '../../../core/orrery/star-field';
import { OrreryPalette, rgba } from './orrery-palette';

const DEG = Math.PI / 180;
/** The twelve signs are a dial, not a claim: each world's longitude is its
 *  own, and the ring is how one world's place is read against another's. */
const HOUSES = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;
/** The dial turns this many radians a second: slowly enough to feel, not watch. */
const DIAL_TURN = 0.006;
const DIAL_SQUASH = 0.62;
const DIAL_TICKS = 72;
const DIAL_MAJOR_EVERY = 6;
/** Below this screen radius the dial is noise. */
const DIAL_MIN_RADIUS = 40;
/** House names only when there is room to read them. */
const HOUSE_LABEL_SCALE = 0.3;
const GRAIN_SIZE = 128;
const GRAIN_ALPHA = 0.045;

export function paintBackground(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  palette: OrreryPalette,
): void {
  const { width, height } = view;
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.85,
  );
  // The sun lights its own system, so the ground warms toward the centre.
  gradient.addColorStop(0, rgba(palette.skyCentre));
  gradient.addColorStop(0.42, rgba(palette.skyMid));
  gradient.addColorStop(1, rgba(palette.skyEdge));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/** Distant stars move less than the system as the view pans: parallax. */
export function paintField(
  ctx: CanvasRenderingContext2D,
  stars: readonly FieldStar[],
  camera: OrreryCamera,
  view: Viewport,
  time: number,
  palette: OrreryPalette,
): void {
  const { x, y, scale } = camera.current;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const star of stars) {
    const sx = (star.x - x) * scale * star.depth + view.width / 2;
    const sy = (star.y - y) * scale * star.depth + view.height / 2;
    if (sx < -10 || sy < -10 || sx > view.width + 10 || sy > view.height + 10) continue;
    const level = twinkle(star, time);
    ctx.fillStyle = rgba(palette.stars[star.tint], star.alpha * level);
    ctx.beginPath();
    ctx.arc(sx, sy, star.radius * (0.85 + level * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The outer dial, turning very slowly: what makes the drawing read as an
 *  instrument rather than a diagram. */
export function paintDial(
  ctx: CanvasRenderingContext2D,
  centre: readonly [number, number],
  radius: number,
  time: number,
  scale: number,
  palette: OrreryPalette,
): void {
  if (radius < DIAL_MIN_RADIUS) return;
  ctx.save();
  ctx.translate(centre[0], centre[1]);
  ctx.rotate(time * DIAL_TURN);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(palette.dial, 0.16);
  for (const [ring, alpha] of [
    [1, 1],
    [0.955, 0.5],
  ] as const) {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * ring, radius * DIAL_SQUASH * ring, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let tick = 0; tick < DIAL_TICKS; tick++) {
    const angle = tick * 5 * DEG;
    const isMajor = tick % DIAL_MAJOR_EVERY === 0;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * DIAL_SQUASH;
    const inner = isMajor ? 0.93 : 0.955;
    ctx.globalAlpha = isMajor ? 0.62 : 0.24;
    ctx.strokeStyle = rgba(palette.dial, 0.5);
    ctx.beginPath();
    ctx.moveTo(x * inner, y * inner);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  if (scale > HOUSE_LABEL_SCALE) {
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = rgba(palette.muted);
    ctx.font = `italic 300 12px ${palette.fontSerif}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    HOUSES.forEach((house, index) => {
      const angle = index * 30 * DEG;
      ctx.fillText(
        house,
        Math.cos(angle) * radius * 1.07,
        Math.sin(angle) * radius * DIAL_SQUASH * 1.07,
      );
    });
  }
  ctx.restore();
}

export function paintVignette(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  palette: OrreryPalette,
): void {
  const { width, height } = view;
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.3,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.78,
  );
  gradient.addColorStop(0, rgba(palette.vignette, 0));
  gradient.addColorStop(1, rgba(palette.vignette, 0.72));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/** A tile of noise, made once, laid over the frame as film grain. */
export function makeGrain(document: Document, random: () => number): HTMLCanvasElement {
  const grain = document.createElement('canvas');
  grain.width = grain.height = GRAIN_SIZE;
  const context = grain.getContext('2d');
  if (!context) return grain;
  const image = context.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  for (let index = 0; index < image.data.length; index += 4) {
    const value = 118 + random() * 140;
    image.data[index] = image.data[index + 1] = image.data[index + 2] = value;
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return grain;
}

/** The grain shifts every frame while the sky moves, and holds still with it. */
export function paintGrain(
  ctx: CanvasRenderingContext2D,
  grain: HTMLCanvasElement,
  view: Viewport,
  time: number,
  isStill: boolean,
): void {
  const pattern = ctx.createPattern(grain, 'repeat');
  if (!pattern) return;
  const ox = isStill ? 0 : Math.trunc(Math.sin(time * 37) * 64);
  const oy = isStill ? 0 : Math.trunc(Math.cos(time * 41) * 64);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = GRAIN_ALPHA;
  ctx.translate(ox, oy);
  ctx.fillStyle = pattern;
  ctx.fillRect(
    -ox - GRAIN_SIZE,
    -oy - GRAIN_SIZE,
    view.width + GRAIN_SIZE * 2,
    view.height + GRAIN_SIZE * 2,
  );
  ctx.restore();
}
