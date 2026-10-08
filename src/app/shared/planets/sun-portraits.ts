import { StarType } from '../gl/star-shader';
import { PaintedImages } from './painted-images';
import { PortraitPainter, SUN_FRAME } from './planet-portrait.types';

/** One star picture to have ready. */
export interface PortraitRequest {
  readonly type: StarType;
  /** Its colour, as an `r, g, b` triple. */
  readonly ink: string;
  /** The star's radius on screen, in CSS pixels. */
  readonly radius: number;
}

/** Sizes are rounded up to a step, so stars of nearly one size share a picture. */
const SIZE_STEP_PX = 16;
const MAX_PIXELS = 256;
/** Enough for every star on show at a few sizes; past it the cache starts over. */
const MAX_IMAGES = 120;

/** A body's picture size in pixels, `frame` of its radii each side, stepped and capped. */
export const portraitPixels = (radius: number, frame: number, pixelRatio: number): number =>
  Math.min(MAX_PIXELS, Math.ceil((radius * frame * 2 * pixelRatio) / SIZE_STEP_PX) * SIZE_STEP_PX);

const pixelsFor = (radius: number, pixelRatio: number): number =>
  portraitPixels(radius, SUN_FRAME, pixelRatio);

export const portraitKey = (request: PortraitRequest, pixelRatio: number): string =>
  `${request.type}|${request.ink}|${pixelsFor(request.radius, pixelRatio)}`;

/**
 * Stars on a 2D sky as the review queue draws its stars close up, painted
 * once each by the shared portrait painter and kept as images for the canvas.
 * Until one has loaded the sky draws its flat glow instead.
 */
export class SunPortraits {
  private readonly images: PaintedImages;

  constructor(document: Document, onLoad: () => void) {
    this.images = new PaintedImages(document, onLoad, MAX_IMAGES);
  }

  /** Paints every picture not painted yet. */
  prepare(
    painter: PortraitPainter,
    requests: readonly PortraitRequest[],
    pixelRatio: number,
  ): void {
    for (const request of requests) {
      this.images.ensure(portraitKey(request, pixelRatio), () =>
        painter.sun({
          type: request.type,
          ink: request.ink,
          px: pixelsFor(request.radius, pixelRatio),
        }),
      );
    }
  }

  /** The picture for `key` once it has loaded, else null. */
  imageFor(key: string): HTMLImageElement | null {
    return this.images.imageFor(key);
  }
}
