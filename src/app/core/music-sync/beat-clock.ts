/** Beats never come closer than this, so a beat-lit sky flashes at most three
 *  times in any second, as WCAG 2.3.1 allows. */
export const MIN_BEAT_GAP_S = 0.34;
/** The beat's length range: 176 down to 80 BPM. */
const MIN_PERIOD_S = 60 / 176;
const MAX_PERIOD_S = 60 / 80;
const PERIOD_STEP_S = 0.002;
/** Kicks this far back count toward the tempo. */
const HISTORY_S = 4;
/** Kicks needed before the tempo is trusted. */
const MIN_KICKS_TO_LOCK = 4;
/** How far, as a share of the beat, an interval may sit off the beat and still count. */
const TOLERANCE = 0.06;
/** Intervals up to this many beats long count toward the tempo. */
const MAX_BEATS_APART = 4;
/** A kick this close to a beat, as a share of the beat, belongs to it. */
const MATCH_WINDOW = 0.25;
/** How far the beat moves toward a kick that lands off it. */
const PHASE_GAIN = 0.35;
/** The beat keeps going this many beats past the last kick on it, then rests:
 *  a breakdown's quiet is quiet, not a phantom four-to-the-floor. */
const HOLD_BEATS = 6;
/** A beat fires this early, to make up for the analyser and the kick finder
 *  hearing a kick a frame or two after it starts. */
const LEAD_S = 0.03;
/** How fast a beat's pulse dies away, per second. */
const PULSE_DECAY = 7;

/** One moment of the beat. */
export interface BeatReading {
  /** A beat lands on this frame. */
  readonly beat: boolean;
  /** 1 on a beat, dying away toward the next. */
  readonly pulse: number;
}

/** Keeps the 4/4 beat from the kicks it hears. Until it has the tempo, each kick
 *  is a beat; once it does, beats land on the tempo's grid, ahead of the kick
 *  being heard and through the odd kick it misses, nudged by each kick that lands
 *  near one. */
export class BeatClock {
  private kicks: number[] = [];
  private periodS: number | null = null;
  private nextBeatS: number | null = null;
  private lastBeatS = Number.NEGATIVE_INFINITY;
  private lastOnBeatS = Number.NEGATIVE_INFINITY;

  /** The beat at `timeS`, given whether a kick started then. */
  read(kick: boolean, timeS: number): BeatReading {
    if (kick) this.hear(timeS);
    const beat = this.isLocked(timeS) ? this.gridBeat(timeS) : kick && this.canFire(timeS);
    if (beat) this.lastBeatS = timeS;
    return { beat, pulse: Math.exp(-PULSE_DECAY * Math.max(0, timeS - this.lastBeatS)) };
  }

  private hear(timeS: number): void {
    this.kicks = [...this.kicks.filter((kickS) => timeS - kickS <= HISTORY_S), timeS];
    if (this.kicks.length < MIN_KICKS_TO_LOCK) return;
    this.periodS = periodOf(this.kicks);
    if (this.isLocked(timeS) && this.nudge(timeS)) return;
    // A first lock, or a kick off the grid after the beat was lost: the grid starts on this kick.
    this.lastOnBeatS = timeS;
    this.nextBeatS = timeS;
  }

  /** Moves the grid toward a kick near one of its beats; false if the kick is off it. */
  private nudge(timeS: number): boolean {
    const period = this.periodS;
    const next = this.nextBeatS;
    if (period === null || next === null) return false;
    const previous = next - period;
    const offS =
      Math.abs(timeS - previous) < Math.abs(timeS - next) ? timeS - previous : timeS - next;
    if (Math.abs(offS) > period * MATCH_WINDOW) return false;
    this.nextBeatS = next + offS * PHASE_GAIN;
    this.lastOnBeatS = timeS;
    return true;
  }

  private gridBeat(timeS: number): boolean {
    const period = this.periodS;
    if (period === null || this.nextBeatS === null) return false;
    // After a stall (a hidden tab), skip the beats missed rather than firing them all.
    while (this.nextBeatS + period < timeS) this.nextBeatS += period;
    if (timeS + LEAD_S < this.nextBeatS || !this.canFire(timeS)) return false;
    this.nextBeatS += period;
    return true;
  }

  private isLocked(timeS: number): boolean {
    return (
      this.periodS !== null &&
      this.nextBeatS !== null &&
      timeS - this.lastOnBeatS <= this.periodS * HOLD_BEATS
    );
  }

  private canFire(timeS: number): boolean {
    return timeS - this.lastBeatS >= MIN_BEAT_GAP_S;
  }
}

/** The beat length that best explains the gaps between `kicks`, counting every
 *  pair, so a missed kick (a gap two beats long) still votes for the beat. */
function periodOf(kicks: readonly number[]): number {
  let best = MIN_PERIOD_S;
  let bestScore = -1;
  for (let period = MIN_PERIOD_S; period <= MAX_PERIOD_S; period += PERIOD_STEP_S) {
    let score = 0;
    for (let i = 0; i < kicks.length; i++)
      for (let j = i + 1; j < kicks.length; j++) {
        const beats = (kicks[j] - kicks[i]) / period;
        const whole = Math.round(beats);
        if (whole < 1 || whole > MAX_BEATS_APART) continue;
        const off = Math.abs(beats - whole);
        if (off < TOLERANCE) score += (1 - off / TOLERANCE) / whole;
      }
    if (score > bestScore) {
      best = period;
      bestScore = score;
    }
  }
  return best;
}
