/** The glow is drawn this many times smaller than the screen; scaling it back
 *  up softens it for free. */
const SHRINK = 4;
const BLUR_PX = 3;

/** A soft glow over everything drawn: a small, blurred copy of the canvas added
 *  back over it. */
export class Bloom {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;

  constructor(document: Document) {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
  }

  /** Adds `target`'s glow back onto it through `onto`, at `strength` from 0 to 1. */
  apply(target: HTMLCanvasElement, onto: CanvasRenderingContext2D, strength: number): void {
    const glow = this.context;
    if (!glow || strength <= 0) return;
    const width = Math.max(1, Math.ceil(target.width / SHRINK));
    const height = Math.max(1, Math.ceil(target.height / SHRINK));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    glow.clearRect(0, 0, width, height);
    glow.filter = `blur(${BLUR_PX}px)`;
    glow.drawImage(target, 0, 0, width, height);
    onto.setTransform(1, 0, 0, 1, 0, 0);
    onto.globalCompositeOperation = 'lighter';
    onto.globalAlpha = Math.min(1, strength);
    onto.drawImage(this.canvas, 0, 0, target.width, target.height);
  }
}
