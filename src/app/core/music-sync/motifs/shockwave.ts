import { MusicFrame } from '../music-sync.types';
import { MotifLayer, MusicInks, MusicScene, reachOf } from './motif-layer';

interface Ring {
  radius: number;
  strength: number;
}

const BASE_SPEED_PX = 260;
const ENERGY_SPEED_PX = 520;
const MAX_RINGS = 14;
const START_AT = 1.15;
const MIN_WIDTH_PX = 1.5;
const BASS_WIDTH_PX = 7;
const RING_ALPHA = 0.55;

/** Every kick sends a ring out from the core across the sky. */
export class Shockwave implements MotifLayer {
  private rings: Ring[] = [];
  private speed = BASE_SPEED_PX;
  private width = MIN_WIDTH_PX;

  step(frame: MusicFrame, stepS: number, scene: MusicScene): void {
    this.speed = BASE_SPEED_PX + frame.energy * ENERGY_SPEED_PX;
    this.width = MIN_WIDTH_PX + frame.bass * BASS_WIDTH_PX;
    if (frame.beat) this.rings.push({ radius: scene.coreRadius * START_AT, strength: frame.bass });
    const reach = reachOf(scene);
    this.rings = this.rings
      .map((ring) => ({ ...ring, radius: ring.radius + this.speed * stepS }))
      .filter((ring) => ring.radius < reach)
      .slice(-MAX_RINGS);
  }

  draw(context: CanvasRenderingContext2D, scene: MusicScene, inks: MusicInks): void {
    const reach = reachOf(scene);
    context.lineWidth = this.width;
    this.rings.forEach((ring, index) => {
      context.globalAlpha = RING_ALPHA * ring.strength * (1 - ring.radius / reach);
      context.strokeStyle = index % 2 === 0 ? inks.primary : inks.secondary;
      context.beginPath();
      context.arc(scene.originX, scene.originY, ring.radius, 0, Math.PI * 2);
      context.stroke();
    });
  }
}
