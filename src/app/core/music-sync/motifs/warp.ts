import { MusicFrame } from '../music-sync.types';
import { MotifLayer, MusicInks, MusicScene, reachOf } from './motif-layer';

interface Streak {
  angle: number;
  distance: number;
}

const STREAKS = 160;
const DRIFT_PX = 40;
const ENERGY_SPEED_PX = 900;
/** A beat throws the stars forward, at least this hard however soft the bass,
 *  and the throw dies away within a beat. */
const BEAT_BOOST_PX = 1100;
const MIN_BOOST_SHARE = 0.7;
/** How much a beat lights the streaks. */
const BEAT_LIGHT = 0.6;
const BOOST_DECAY = 6;
const LENGTH_PER_SPEED = 0.06;
const STREAK_ALPHA = 0.7;
const START_AT = 1.2;
/** Stars near the core crawl and speed up outward, as perspective would have it. */
const NEAR_PACE = 0.2;
const STREAK_WIDTH_PX = 1.4;
/** One streak in this many takes the accent colour. */
const ACCENT_EVERY = 3;
/** The streaks are fully lit by half the music's full energy. */
const LIT_BY_ENERGY = 2;

/** Stars stream out of the core as if the sky were jumping to light speed:
 *  faster as the music fills, thrown forward on each beat. */
export class Warp implements MotifLayer {
  private readonly streaks: Streak[] = [];
  private speed = DRIFT_PX;
  private boost = 0;
  private level = 0;

  step(frame: MusicFrame, stepS: number, scene: MusicScene): void {
    const reach = reachOf(scene);
    if (this.streaks.length === 0) this.seed(scene, reach);
    if (frame.beat) this.boost = BEAT_BOOST_PX * Math.max(frame.bass, MIN_BOOST_SHARE);
    this.boost *= Math.exp(-BOOST_DECAY * stepS);
    this.speed = DRIFT_PX + frame.energy * ENERGY_SPEED_PX + this.boost;
    this.level = Math.min(1, frame.energy * LIT_BY_ENERGY + frame.pulse * BEAT_LIGHT);
    for (const streak of this.streaks) {
      streak.distance += this.speed * stepS * (streak.distance / reach + NEAR_PACE);
      if (streak.distance > reach) this.respawn(streak, scene);
    }
  }

  draw(context: CanvasRenderingContext2D, scene: MusicScene, inks: MusicInks): void {
    const length = this.speed * LENGTH_PER_SPEED;
    context.lineWidth = STREAK_WIDTH_PX;
    context.globalAlpha = STREAK_ALPHA * this.level;
    this.streaks.forEach((streak, index) => {
      const cos = Math.cos(streak.angle);
      const sin = Math.sin(streak.angle);
      context.strokeStyle = index % ACCENT_EVERY === 0 ? inks.accent : inks.primary;
      context.beginPath();
      context.moveTo(scene.originX + cos * streak.distance, scene.originY + sin * streak.distance);
      context.lineTo(
        scene.originX + cos * (streak.distance + length),
        scene.originY + sin * (streak.distance + length),
      );
      context.stroke();
    });
  }

  private seed(scene: MusicScene, reach: number): void {
    for (let i = 0; i < STREAKS; i++) {
      const streak = { angle: 0, distance: 0 };
      this.respawn(streak, scene);
      streak.distance += Math.random() * reach;
      this.streaks.push(streak);
    }
  }

  private respawn(streak: Streak, scene: MusicScene): void {
    streak.angle = Math.random() * Math.PI * 2;
    streak.distance = scene.coreRadius * START_AT;
  }
}
