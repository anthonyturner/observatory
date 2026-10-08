/** Sizes are rounded up to a step, so bodies of nearly one size share a picture. */
const SIZE_STEP_PX = 16;
const MAX_PIXELS = 256;

/** A body's picture size in pixels, `frame` of its radii each side, stepped and capped. */
export const portraitPixels = (radius: number, frame: number, pixelRatio: number): number =>
  Math.min(MAX_PIXELS, Math.ceil((radius * frame * 2 * pixelRatio) / SIZE_STEP_PX) * SIZE_STEP_PX);

/**
 * Pictures painted once each, by key, and kept as images for a canvas. A
 * picture is given out only once it has loaded; until then the sky draws its
 * flat stand-in. Past `limit` pictures the cache starts over.
 */
export class PaintedImages {
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly loaded = new Set<string>();

  constructor(
    private readonly document: Document,
    private readonly onLoad: () => void,
    private readonly limit: number,
  ) {}

  /** Paints `key`'s picture with `paint`, an image URL, unless it has one already. */
  ensure(key: string, paint: () => string): void {
    if (this.images.has(key)) return;
    if (this.images.size >= this.limit) this.clear();
    const image = this.document.createElement('img');
    image.onload = () => {
      this.loaded.add(key);
      this.onLoad();
    };
    image.src = paint();
    this.images.set(key, image);
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
