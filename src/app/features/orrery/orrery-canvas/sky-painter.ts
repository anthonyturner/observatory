import { orbitPoint } from '../../../core/orrery/orbit';
import { OrreryCamera, Viewport } from '../../../core/orrery/orrery-camera';
import { rgba } from '../../../shared/night-sky/night-sky';
import { OrreryPalette } from './orrery-palette';

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

/** The house names round the 3D dial, on its turning plane: the 3D scene draws
 *  the rings and ticks, and the names stay sharp on the canvas over it. */
export function paintHouses3D(
  ctx: CanvasRenderingContext2D,
  camera: OrreryCamera,
  view: Viewport,
  radius: number,
  time: number,
  palette: OrreryPalette,
): void {
  if (camera.current.scale <= HOUSE_LABEL_SCALE) return;
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = rgba(palette.muted);
  ctx.font = `italic 300 12px ${palette.fontSerif}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  HOUSES.forEach((house, index) => {
    const point = orbitPoint(radius * 1.07, index * 30 * DEG + time * DIAL_TURN);
    const [x, y] = camera.toScreenAt(point.x, point.y, point.z, view);
    ctx.fillText(house, x, y);
  });
  ctx.restore();
}
