import { MilkdropStage } from '../milkdrop/milkdrop-stage';
import { MusicFrame } from '../music-sync.types';
import { MotifLayer, MusicInks, MusicScene } from './motif-layer';

/** Milkdrop renders at this share of the screen's size, then is drawn up to
 *  fill it: its looks are soft, and full size costs the frame rate. */
const RENDER_SCALE = 0.5;

/** A Milkdrop preset filling the sky at the `opacity` asked for, picked by the
 *  theme's variant. Until Milkdrop has loaded, or where it cannot run,
 *  `fallback` draws instead; hidden, it draws and renders nothing. */
export class Milkdrop implements MotifLayer {
  private picture: HTMLCanvasElement | null = null;

  constructor(
    private readonly stage: MilkdropStage,
    variant: number,
    private readonly fallback: MotifLayer,
    private readonly opacity: () => number,
  ) {
    stage.show(variant);
  }

  step(frame: MusicFrame, stepS: number, scene: MusicScene): void {
    if (this.opacity() <= 0) {
      this.picture = null;
      return;
    }
    this.picture = this.stage.frame(
      Math.max(1, Math.round(scene.width * RENDER_SCALE)),
      Math.max(1, Math.round(scene.height * RENDER_SCALE)),
    );
    if (!this.picture) this.fallback.step(frame, stepS, scene);
  }

  draw(context: CanvasRenderingContext2D, scene: MusicScene, inks: MusicInks): void {
    const opacity = this.opacity();
    if (opacity <= 0) return;
    if (!this.picture) return this.fallback.draw(context, scene, inks);
    context.globalAlpha = opacity;
    context.drawImage(this.picture, 0, 0, scene.width, scene.height);
  }
}
