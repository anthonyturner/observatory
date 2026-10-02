import { MusicFrame } from '../music-sync.types';
import { MotifLayer, MusicInks, MusicScene } from './motif-layer';

/** Each ribbon's height on the screen, wave count and drift, as fractions and rates. */
const RIBBONS = [
  { top: 0.12, waves: 1.6, drift: 0.35 },
  { top: 0.2, waves: 2.3, drift: -0.5 },
  { top: 0.3, waves: 1.1, drift: 0.22 },
] as const;
const STEP_PX = 16;
const MID_SWING_PX = 90;
const CURTAIN_PX = 220;
const BASE_ALPHA = 0.14;
const BASS_ALPHA = 0.45;
const KICK_FLARE = 0.12;
const FLARE_DECAY = 5;
/** The ribbons drift at a walk in silence and run as the music fills. */
const IDLE_PACE = 0.6;
const ENERGY_PACE = 2.4;
const DRIFT_SCALE = 4;
/** Each ribbon is a broad swell with a quicker ripple riding on it. */
const SWELL_PX = 24;
const RIPPLE_PX = 10;
const RIPPLE_FREQUENCY = 2.7;
/** How far above the ribbon's line its glow starts, and where along it the colour is fullest. */
const LEAD_IN = 0.2;
const BRIGHTEST_AT = 0.25;

/** Curtains of light across the top of the sky: the leads swing them, the
 *  bass brightens them, and a kick lights them for a moment. */
export class Aurora implements MotifLayer {
  private phase = 0;
  private swing = 0;
  private glow = BASE_ALPHA;
  private flare = 0;

  step(frame: MusicFrame, stepS: number): void {
    this.phase += stepS * (IDLE_PACE + frame.energy * ENERGY_PACE);
    this.swing = frame.mid * MID_SWING_PX;
    if (frame.beat) this.flare = KICK_FLARE;
    this.flare *= Math.exp(-FLARE_DECAY * stepS);
    this.glow = BASE_ALPHA + frame.bass * BASS_ALPHA + this.flare;
  }

  draw(context: CanvasRenderingContext2D, scene: MusicScene, inks: MusicInks): void {
    const colours = [inks.primary, inks.secondary, inks.accent];
    RIBBONS.forEach((ribbon, index) => {
      const baseY = scene.height * ribbon.top;
      const gradient = context.createLinearGradient(
        0,
        baseY - CURTAIN_PX * LEAD_IN,
        0,
        baseY + CURTAIN_PX,
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(BRIGHTEST_AT, colours[index]);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      context.globalAlpha = this.glow;
      context.fillStyle = gradient;
      context.beginPath();
      for (let x = 0; x <= scene.width + STEP_PX; x += STEP_PX) {
        const y = baseY + this.waveAt(x / scene.width, ribbon);
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.lineTo(scene.width + STEP_PX, baseY + CURTAIN_PX);
      context.lineTo(0, baseY + CURTAIN_PX);
      context.closePath();
      context.fill();
    });
  }

  private waveAt(across: number, ribbon: (typeof RIBBONS)[number]): number {
    const turn = across * ribbon.waves * Math.PI * 2 + this.phase * ribbon.drift * DRIFT_SCALE;
    const swell = Math.sin(turn) * (SWELL_PX + this.swing);
    return swell + Math.sin(turn * RIPPLE_FREQUENCY + this.phase) * RIPPLE_PX;
  }
}
