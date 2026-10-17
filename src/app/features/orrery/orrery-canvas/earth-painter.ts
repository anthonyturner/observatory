import { MapPixels, earthDisc } from '../../../core/orrery/earth';
import { rgba } from '../../../shared/night-sky/night-sky';
import { OrreryPalette } from './orrery-palette';

/** The map is read at this size, and the disc made at this size: plenty for an Earth a few hundred pixels across. */
const MAP_SIZE = { width: 512, height: 256 } as const;
const DISC_SIZE = 256;
/** The far limb goes this dark, and the terminator is a thin warm band either side of the half-way line. */
const NIGHT_SHADE = 0.55;
const TERMINATOR_WARMTH = 0.16;
const LIMB_ALPHA = 0.35;

/** The NASA day map as a flat disc facing the viewer, ready to draw, or null where no 2D canvas can be made. */
export function makeEarthDisc(document: Document, day: HTMLImageElement): HTMLCanvasElement | null {
  const map = document.createElement('canvas');
  map.width = MAP_SIZE.width;
  map.height = MAP_SIZE.height;
  const mapContext = map.getContext('2d', { willReadFrequently: true });
  const disc = document.createElement('canvas');
  disc.width = disc.height = DISC_SIZE;
  const discContext = disc.getContext('2d');
  if (!mapContext || !discContext) return null;
  mapContext.drawImage(day, 0, 0, MAP_SIZE.width, MAP_SIZE.height);
  const pixels: MapPixels = mapContext.getImageData(0, 0, MAP_SIZE.width, MAP_SIZE.height);
  const image = discContext.createImageData(DISC_SIZE, DISC_SIZE);
  image.data.set(earthDisc(pixels, DISC_SIZE));
  discContext.putImageData(image, 0, 0);
  return disc;
}

/**
 * The Earth for the 2D orrery: the day disc, shaded dark on the side away from
 * the sun with a thin warm terminator, and a faint blue limb. No clouds or
 * lights. `sunward` is the angle toward the sun; `disc` is null until the
 * picture has loaded, when a flat sea-coloured disc stands in.
 */
export function paintEarth(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  sunward: number,
  disc: HTMLCanvasElement | null,
  palette: OrreryPalette,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  if (disc) {
    ctx.drawImage(disc, cx - radius, cy - radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = rgba(palette.earthSea);
    ctx.fill();
  }
  const dx = Math.cos(sunward) * radius;
  const dy = Math.sin(sunward) * radius;
  const across = ctx.createLinearGradient(cx + dx, cy + dy, cx - dx, cy - dy);
  across.addColorStop(0.44, 'rgba(0, 0, 0, 0)');
  across.addColorStop(0.56, rgba('0, 0, 0', NIGHT_SHADE * 0.5));
  across.addColorStop(1, rgba('0, 0, 0', NIGHT_SHADE));
  ctx.fillStyle = across;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  const terminator = ctx.createLinearGradient(cx + dx, cy + dy, cx - dx, cy - dy);
  terminator.addColorStop(0.42, rgba(palette.earthDusk, 0));
  terminator.addColorStop(0.5, rgba(palette.earthDusk, TERMINATOR_WARMTH));
  terminator.addColorStop(0.58, rgba(palette.earthDusk, 0));
  ctx.fillStyle = terminator;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = rgba(palette.earthAir, LIMB_ALPHA);
  ctx.lineWidth = Math.max(1, radius * 0.025);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
