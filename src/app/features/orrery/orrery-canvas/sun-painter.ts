import { rgba } from '../../../shared/night-sky/night-sky';
import { OrreryPalette } from './orrery-palette';

const RAYS = 16;
/** The halo stays close, so the space round the sun stays dark. */
const HALO_REACH = 2.2;
/** Below this zoom the total on the sun is too small to read. */
const LABEL_MIN_SCALE = 0.2;

/** The sun, drawn into the glow layer: a breathing halo, corona rays, a body. */
export function paintSun(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  time: number,
  palette: OrreryPalette,
): void {
  const breathe = 0.9 + Math.sin(time * 0.7) * 0.1;
  const haloRadius = radius * HALO_REACH * breathe;
  c.save();
  const halo = c.createRadialGradient(cx, cy, 0, cx, cy, haloRadius);
  halo.addColorStop(0.4, rgba(palette.sunGlow, 0.5));
  halo.addColorStop(0.6, rgba(palette.sunHalo, 0.12));
  halo.addColorStop(1, rgba(palette.sunHalo, 0));
  c.fillStyle = halo;
  c.beginPath();
  c.arc(cx, cy, haloRadius, 0, Math.PI * 2);
  c.fill();

  // A star seen through any real optic has rays, and they give the centre of
  // the system somewhere to radiate from.
  c.globalAlpha = 0.2;
  c.lineWidth = Math.max(radius * 0.05, 0.6);
  for (let ray = 0; ray < RAYS; ray++) {
    const angle = ray * ((Math.PI * 2) / RAYS) + time * 0.05;
    const length = radius * (1.6 + Math.sin(time * 1.3 + ray) * 0.25);
    const ex = cx + Math.cos(angle) * length;
    const ey = cy + Math.sin(angle) * length;
    const fade = c.createLinearGradient(cx, cy, ex, ey);
    fade.addColorStop(0, rgba(palette.sunRay, 0.7));
    fade.addColorStop(1, rgba(palette.sunHalo, 0));
    c.strokeStyle = fade;
    c.beginPath();
    c.moveTo(cx + Math.cos(angle) * radius * 0.9, cy + Math.sin(angle) * radius * 0.9);
    c.lineTo(ex, ey);
    c.stroke();
  }

  c.globalAlpha = 1;
  c.fillStyle = rgba(palette.sunBody);
  c.beginPath();
  c.arc(cx, cy, radius, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = rgba(palette.sunCore);
  c.beginPath();
  c.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** The total of open pull requests, on the sun, drawn after the glow so it stays legible. */
export function paintSunLabel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  total: number,
  scale: number,
  palette: OrreryPalette,
): void {
  if (scale < LABEL_MIN_SCALE) return;
  ctx.save();
  ctx.fillStyle = rgba(palette.sunInk);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.max(11, radius * 0.62)}px ${palette.fontMono}`;
  ctx.fillText(String(total), cx, cy + 1);
  ctx.restore();
}
