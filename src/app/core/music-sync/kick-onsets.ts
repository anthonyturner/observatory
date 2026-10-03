import { follow } from './follow';

/** How quickly the kick band's baseline follows it, per second: slow enough that
 *  a kick stands clear of it, quick enough to settle back between kicks. */
const BASELINE_FOLLOW = 6;
/** How quickly the typical rise over the baseline is learned, per second. */
const STATS_FOLLOW = 0.8;
/** A kick rises this many spreads above the typical rise… */
const SPREAD = 1.2;
/** …and never less than this, on the analyser's 0–1 decibel scale. */
const MIN_RISE = 0.03;
/** A kick's tail never counts as a second kick. */
const MIN_GAP_S = 0.15;

/** Finds where kicks start in the kick band's level. Levels arrive on a decibel
 *  scale, where a kick over a loud bassline is a small step up rather than a
 *  multiple, so a kick is a rise over the band's recent baseline that stands out
 *  from the rises the music usually makes. */
export class KickOnsets {
  private baseline = 0;
  private meanRise = 0;
  private riseVariance = 0;
  private wasAbove = false;
  private lastOnsetS = Number.NEGATIVE_INFINITY;
  private lastS: number | null = null;

  /** Whether a kick starts at `timeS` with the kick band at `level`. */
  read(level: number, timeS: number): boolean {
    // The first level is where the band starts, not a rise from nothing.
    if (this.lastS === null) this.baseline = level;
    const stepS = this.lastS === null ? 0 : Math.max(0, timeS - this.lastS);
    this.lastS = timeS;
    const rise = Math.max(0, level - this.baseline);
    const threshold = Math.max(MIN_RISE, this.meanRise + SPREAD * Math.sqrt(this.riseVariance));
    const above = rise > threshold;
    const onset = above && !this.wasAbove && timeS - this.lastOnsetS >= MIN_GAP_S;
    this.wasAbove = above;
    if (onset) this.lastOnsetS = timeS;
    this.learn(rise, stepS);
    this.baseline = follow(this.baseline, level, BASELINE_FOLLOW, stepS);
    return onset;
  }

  private learn(rise: number, stepS: number): void {
    const deviation = rise - this.meanRise;
    this.meanRise = follow(this.meanRise, rise, STATS_FOLLOW, stepS);
    this.riseVariance = follow(this.riseVariance, deviation * deviation, STATS_FOLLOW, stepS);
  }
}
