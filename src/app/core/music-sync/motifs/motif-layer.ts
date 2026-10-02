import { MusicFrame } from '../music-sync.types';

/** The screen the music is drawn on, and where the core sits in it, in CSS pixels. */
export interface MusicScene {
  readonly width: number;
  readonly height: number;
  readonly originX: number;
  readonly originY: number;
  readonly coreRadius: number;
}

/** Three colours a palette lends every layer. */
export interface MusicInks {
  readonly primary: string;
  readonly secondary: string;
  readonly accent: string;
}

/** One way of moving with the music. `step` advances it; `draw` paints it. */
export interface MotifLayer {
  step(frame: MusicFrame, stepS: number, scene: MusicScene): void;
  draw(context: CanvasRenderingContext2D, scene: MusicScene, inks: MusicInks): void;
}

/** The farthest any point of the screen is from the core. */
export function reachOf(scene: MusicScene): number {
  const dx = Math.max(scene.originX, scene.width - scene.originX);
  const dy = Math.max(scene.originY, scene.height - scene.originY);
  return Math.hypot(dx, dy);
}
