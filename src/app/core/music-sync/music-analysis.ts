import { BandLevels, MusicFrame } from './music-sync.types';

/** A kick stands this far above the recent bass to count as a beat. */
const BEAT_RISE = 1.3;
/** Below this the bass is too quiet for any beat: a breakdown, or silence. */
const BEAT_FLOOR = 0.25;
/** Under three beats a second (176 BPM), so a beat-lit sky never flashes faster
 *  than WCAG 2.3.1 allows, and a kick's tail never counts as a second kick. */
const MIN_BEAT_GAP_S = 0.34;
/** How quickly the recent bass follows the music, per second. */
const BASS_FOLLOW = 4;

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
  private recentBass = 0;
  private shortEnergy = 0;
  private longEnergy = 0;
  private lastBeatS = Number.NEGATIVE_INFINITY;
  private lastDropS = Number.NEGATIVE_INFINITY;
  private lastS: number | null = null;

  /** The frame these levels make at `timeS` seconds. */
  read(levels: BandLevels, timeS: number): MusicFrame {
    const stepS = this.lastS === null ? 0 : Math.max(0, timeS - this.lastS);
    this.lastS = timeS;
    const energy = (levels.bass + levels.mid + levels.high) / 3;
    const beat = this.isBeat(levels.bass, timeS);
    this.recentBass = follow(this.recentBass, levels.bass, BASS_FOLLOW, stepS);
    const drop = this.isDrop(energy, timeS, stepS);
    return { ...levels, energy, beat, drop };
  }

  private isBeat(bass: number, timeS: number): boolean {
    const beat =
      bass >= BEAT_FLOOR &&
      bass > this.recentBass * BEAT_RISE &&
      timeS - this.lastBeatS >= MIN_BEAT_GAP_S;
    if (beat) this.lastBeatS = timeS;
    return beat;
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

/** Moves `from` toward `to` at `rate` per second, over `stepS` seconds. */
function follow(from: number, to: number, rate: number, stepS: number): number {
  return from + (to - from) * (1 - Math.exp(-rate * stepS));
}
