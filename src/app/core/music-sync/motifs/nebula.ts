import { MusicFrame } from '../music-sync.types';
import { MotifLayer, MusicInks, MusicScene } from './motif-layer';

const CLOUDS = 6;
/** How far out the clouds circle, in core radii. */
const ORBIT_FROM = 2.2;
const ORBIT_SPREAD = 1.6;
const SIZE_IN_RADII = 1.8;
const BASS_SWELL = 0.9;
const BEAT_SWELL = 0.6;
const SPIN_PER_S = 0.05;
const ENERGY_SPIN = 0.4;
const CLOUD_ALPHA = 0.22;
/** Every other cloud turns the other way, a little slower, so they pass each other. */
const COUNTER_SPIN = -0.7;
/** Spreads the clouds over their orbits without a visible pattern. */
const ORBIT_SCATTER = 0.37;
/** The clouds circle on a tilted plane, flattened to this much of their width. */
const TILT = 0.6;
/** How bright a cloud is in a breakdown, before the bass fills it. */
const RESTING_GLOW = 0.35;

/** Soft clouds of colour circling the core, breathing with the bass and
 *  swelling on each beat. */
export class Nebula implements MotifLayer {
  private turn = 0;
  private breath = 0;

  step(frame: MusicFrame, stepS: number): void {
    this.turn += stepS * (SPIN_PER_S + frame.energy * ENERGY_SPIN);
    this.breath = frame.bass * BASS_SWELL + frame.pulse * BEAT_SWELL;
  }

  draw(context: CanvasRenderingContext2D, scene: MusicScene, inks: MusicInks): void {
    const colours = [inks.primary, inks.secondary, inks.accent];
    for (let i = 0; i < CLOUDS; i++) {
      const angle = this.turn * (i % 2 === 0 ? 1 : COUNTER_SPIN) + (i / CLOUDS) * Math.PI * 2;
      const orbit = scene.coreRadius * (ORBIT_FROM + ORBIT_SPREAD * ((i * ORBIT_SCATTER) % 1));
      const x = scene.originX + Math.cos(angle) * orbit;
      const y = scene.originY + Math.sin(angle) * orbit * TILT;
      const size = scene.coreRadius * SIZE_IN_RADII * (1 + this.breath);
      const gradient = context.createRadialGradient(x, y, 0, x, y, size);
      gradient.addColorStop(0, colours[i % colours.length]);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      context.globalAlpha = CLOUD_ALPHA * (RESTING_GLOW + this.breath);
      context.fillStyle = gradient;
      context.fillRect(x - size, y - size, size * 2, size * 2);
    }
  }
}
