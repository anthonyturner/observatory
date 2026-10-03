import { MilkdropStage } from '../milkdrop/milkdrop-stage';
import { MusicFrame } from '../music-sync.types';
import { MotifLayer, MusicInks, MusicScene } from './motif-layer';

/** Milkdrop renders at this share of the screen's size, then is drawn up to
 *  fill it: its looks are soft, and full size costs the frame rate. */
const RENDER_SCALE = 0.5;
/** Milkdrop fills the screen, screened over the sky; a touch under full keeps
 *  the beat hits standing out over it. */
const MILKDROP_ALPHA = 0.8;

/** A Milkdrop preset filling the sky, picked by the theme's variant. Until
 *  Milkdrop has loaded, or where it cannot run, `fallback` draws instead. */
export class Milkdrop implements MotifLayer {
  private picture: HTMLCanvasElement | null = null;

  constructor(
    private readonly stage: MilkdropStage,
    variant: number,
    private readonly fallback: MotifLayer,
  ) {
    stage.show(variant);
  }

  step(frame: MusicFrame, stepS: number, scene: MusicScene): void {
    this.picture = this.stage.frame(
      Math.max(1, Math.round(scene.width * RENDER_SCALE)),
      Math.max(1, Math.round(scene.height * RENDER_SCALE)),
    );
    if (!this.picture) this.fallback.step(frame, stepS, scene);
  }

  draw(context: CanvasRenderingContext2D, scene: MusicScene, inks: MusicInks): void {
    if (!this.picture) return this.fallback.draw(context, scene, inks);
    context.globalAlpha = MILKDROP_ALPHA;
    context.drawImage(this.picture, 0, 0, scene.width, scene.height);
  }
}
