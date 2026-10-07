import { StarType } from '../gl/star-shader';
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

const pixelsFor = (radius: number, pixelRatio: number): number =>
  Math.min(
    MAX_PIXELS,
    Math.ceil((radius * SUN_FRAME * 2 * pixelRatio) / SIZE_STEP_PX) * SIZE_STEP_PX,
  );

export const portraitKey = (request: PortraitRequest, pixelRatio: number): string =>
  `${request.type}|${request.ink}|${pixelsFor(request.radius, pixelRatio)}`;

/**
 * Stars on a 2D sky as the review queue draws its stars close up, painted
 * once each by the shared portrait painter and kept as images for the canvas.
 * Until one has loaded the sky draws its flat glow instead.
 */
export class SunPortraits {
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly loaded = new Set<string>();

  constructor(
    private readonly document: Document,
    private readonly onLoad: () => void,
  ) {}

  /** Paints every picture not painted yet. */
  prepare(
    painter: PortraitPainter,
    requests: readonly PortraitRequest[],
    pixelRatio: number,
  ): void {
    for (const request of requests) {
      const key = portraitKey(request, pixelRatio);
      if (this.images.has(key)) continue;
      if (this.images.size >= MAX_IMAGES) this.clear();
      const image = this.document.createElement('img');
      image.onload = () => {
        this.loaded.add(key);
        this.onLoad();
      };
      image.src = painter.sun({
        type: request.type,
        ink: request.ink,
        px: pixelsFor(request.radius, pixelRatio),
      });
      this.images.set(key, image);
    }
  }

  /** The picture for `key` once it has loaded, else null. */
  imageFor(key: string): HTMLImageElement | null {
    return this.loaded.has(key) ? (this.images.get(key) ?? null) : null;
  }

  private clear(): void {
    this.images.clear();
    this.loaded.clear();
  }
}
