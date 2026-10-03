import { BeatClock } from './beat-clock';
import { follow } from './follow';
import { KickOnsets } from './kick-onsets';
import { BandLevels, MusicFrame } from './music-sync.types';

/** The short and long views of the energy a drop is measured between. */
const SHORT_FOLLOW = 3;
const LONG_FOLLOW = 0.25;
/** A drop lifts the short-term energy this far over the long-term. */
const DROP_RISE = 1.5;
const DROP_FLOOR = 0.35;
/** One drop a phrase at most, so a loud passage is not a drop every bar. */
const MIN_DROP_GAP_S = 8;

/** Reads beats and drops from band levels frame by frame. It keeps a little
 *  history, so one analysis follows one stream of music. */
export class MusicAnalysis {
  private readonly kicks = new KickOnsets();
  private readonly clock = new BeatClock();
  private shortEnergy = 0;
  private longEnergy = 0;
  private lastDropS = Number.NEGATIVE_INFINITY;
  private lastS: number | null = null;

  /** The frame these levels make at `timeS` seconds. */
  read(levels: BandLevels, timeS: number): MusicFrame {
    const stepS = this.lastS === null ? 0 : Math.max(0, timeS - this.lastS);
    this.lastS = timeS;
    const energy = (levels.bass + levels.mid + levels.high) / 3;
    const { beat, pulse } = this.clock.read(this.kicks.read(levels.kick, timeS), timeS);
    const drop = this.isDrop(energy, timeS, stepS);
    return { ...levels, energy, beat, pulse, drop };
  }

  private isDrop(energy: number, timeS: number, stepS: number): boolean {
    this.shortEnergy = follow(this.shortEnergy, energy, SHORT_FOLLOW, stepS);
    this.longEnergy = follow(this.longEnergy, energy, LONG_FOLLOW, stepS);
    const drop =
      this.shortEnergy >= DROP_FLOOR &&
      this.shortEnergy > this.longEnergy * DROP_RISE &&
      timeS - this.lastDropS >= MIN_DROP_GAP_S;
    if (drop) this.lastDropS = timeS;
    return drop;
  }
}
