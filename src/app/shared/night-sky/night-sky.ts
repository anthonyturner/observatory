import { parseRgb, resolveColour } from '../../core/instrument/palette';
import { OrreryCamera, Viewport } from '../../core/orrery/orrery-camera';
import { FieldStar, twinkle } from '../../core/orrery/star-field';

// The night both canvases share: the star field, the vignette and the film
// grain, and reading colours from tokens.css as the canvas can take them.

const GRAIN_SIZE = 128;
const GRAIN_ALPHA = 0.045;

/** `rgba()` from an `r, g, b` triple. */
export const rgba = (channels: string, alpha = 1): string => `rgba(${channels}, ${alpha})`;

/** Reads any CSS colour, `var()` included, as an `r, g, b` triple, remembering each. */
export function channelReader(element: HTMLElement): (expression: string) => string {
  const cache = new Map<string, string>();
  return (expression) => {
    const known = cache.get(expression);
    if (known) return known;
    const [r, g, b] = parseRgb(resolveColour(element, expression));
    const triple = `${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}`;
    cache.set(expression, triple);
    return triple;
  };
}

/** Distant stars move less than the system as the view pans: parallax. */
export function paintField(
  ctx: CanvasRenderingContext2D,
  stars: readonly FieldStar[],
  camera: OrreryCamera,
  view: Viewport,
  time: number,
  tints: readonly string[],
): void {
  const { x, y, scale } = camera.current;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const star of stars) {
    const sx = (star.x - x) * scale * star.depth + view.width / 2;
    const sy = (star.y - y) * scale * star.depth + view.height / 2;
    if (sx < -10 || sy < -10 || sx > view.width + 10 || sy > view.height + 10) continue;
    const level = twinkle(star, time);
    ctx.fillStyle = rgba(tints[star.tint], star.alpha * level);
    ctx.beginPath();
    ctx.arc(sx, sy, star.radius * (0.85 + level * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function paintVignette(ctx: CanvasRenderingContext2D, view: Viewport, shade: string): void {
  const { width, height } = view;
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.3,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.78,
  );
  gradient.addColorStop(0, rgba(shade, 0));
  gradient.addColorStop(1, rgba(shade, 0.72));
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
