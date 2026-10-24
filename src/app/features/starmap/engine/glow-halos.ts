/* The 2D sky's bloom: two soft halos of its glow layer, a tight one for shape
   and a wide one for atmosphere. */

/** How far each halo spreads, as the standard deviation of a blur in device pixels. */
const TIGHT_BLUR = 6;
const WIDE_BLUR = 22;

/** How strongly each halo is added over the sky. */
const TIGHT_ALPHA = 0.7;
const WIDE_ALPHA = 0.22;

/** The halos are held at this share of the glow layer's size, and of the tight one's. */
const TIGHT_SCALE = 0.5;
const WIDE_SCALE = 0.5;

/**
 * Blurs the glow layer into two halos without a blur over the whole screen. A
 * blur this wide throws away all fine detail, so it is made on a copy shrunk
 * until the blur is a few pixels, which costs a small fraction of a screen's
 * pixels, and the shrunk copy stretches back soft. The wide halo is blurred
 * from the tight one, adding only the spread it lacks: blurs add in
 * variance, so the two together are as wide as the wide one alone.
 */
export class GlowHalos {
  private readonly tight: HTMLCanvasElement;
  private readonly wide: HTMLCanvasElement;

  constructor(document: Document) {
    this.tight = document.createElement('canvas');
    this.wide = document.createElement('canvas');
  }

  /** Blurs `glow` into the halos. `deviceWidth` is how many device pixels across
   *  the screen is, which the blurs are measured in. */
  update(glow: HTMLCanvasElement, deviceWidth: number): void {
    this.fit(this.tight, glow, TIGHT_SCALE);
    this.fit(this.wide, this.tight, WIDE_SCALE);
    const spread = (canvas: HTMLCanvasElement, blur: number): number =>
      (blur * canvas.width) / deviceWidth;
    this.blur(this.tight, glow, spread(this.tight, TIGHT_BLUR));
    this.blur(
      this.wide,
      this.tight,
      spread(this.wide, Math.sqrt(WIDE_BLUR ** 2 - TIGHT_BLUR ** 2)),
    );
  }

  /** Adds both halos over the whole of `ctx`. */
  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.globalAlpha = TIGHT_ALPHA;
    ctx.drawImage(this.tight, 0, 0, width, height);
    ctx.globalAlpha = WIDE_ALPHA;
    ctx.drawImage(this.wide, 0, 0, width, height);
  }

  /** Sizes `canvas` as a share of `from`, leaving it alone when it is that size already. */
  private fit(canvas: HTMLCanvasElement, from: HTMLCanvasElement, scale: number): void {
    const width = Math.max(2, Math.round(from.width * scale));
    const height = Math.max(2, Math.round(from.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  private blur(into: HTMLCanvasElement, from: HTMLCanvasElement, radius: number): void {
    const ctx = into.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, into.width, into.height);
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(from, 0, 0, into.width, into.height);
  }
}
