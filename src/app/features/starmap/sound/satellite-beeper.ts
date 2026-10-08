import { SATELLITE_RHYTHM, Satellite } from '../../../core/live-agents/satellites';
import { hashString } from '../../../core/orrery/world-layout';

/** No two beeps closer than this, so the whole sky stays under three a second. */
export const MIN_GAP_MS = 350;
const TICK_MS = 100;

interface Beeper {
  readonly key: string;
  readonly everyMs: number;
  readonly lastAt: number;
}

/**
 * Which satellite beeps now, if any: the one furthest past its own period, and
 * only when the last beep from any satellite is a full gap behind. Many agents
 * therefore take turns instead of piling up.
 */
export function nextBeep(
  beepers: readonly Beeper[],
  now: number,
  lastAnyAt: number,
): string | null {
  if (now - lastAnyAt < MIN_GAP_MS) return null;
  let best: string | null = null;
  let bestLate = 0;
  for (const beeper of beepers) {
    const late = now - beeper.lastAt - beeper.everyMs;
    if (late >= bestLate) [best, bestLate] = [beeper.key, late];
  }
  return best;
}

/**
 * Beeps for the satellites on screen, each at its own state's rate. It ticks
 * only while told the sky can be heard. A satellite's first beep comes
 * part-way through its first period, spread by its key, so a new sky does not
 * start with all of them at once.
 */
export class SatelliteBeeper {
  private satellites: readonly Satellite[] = [];
  private readonly lastAt = new Map<string, number>();
  private lastAnyAt = Number.NEGATIVE_INFINITY;
  private timer: ReturnType<typeof setInterval> | null = null;
  private audible = false;

  constructor(
    private readonly beep: (satellite: Satellite) => void,
    private readonly now: () => number = Date.now,
  ) {}

  /** The satellites to beep for, and whether the sky is being heard at all. */
  set(satellites: readonly Satellite[], audible: boolean): void {
    this.satellites = satellites;
    const live = new Set(satellites.map((each) => each.key));
    for (const key of this.lastAt.keys()) if (!live.has(key)) this.lastAt.delete(key);
    if (audible && !this.audible) this.lastAt.clear();
    this.audible = audible;
    const shouldTick = audible && satellites.length > 0;
    if (shouldTick && !this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
    if (!shouldTick) this.dispose();
  }

  /** One look at the clock: beeps for the satellite that is due, if one is. */
  tick(): void {
    if (!this.audible) return;
    const now = this.now();
    const beepers = this.satellites.map((each): Beeper => {
      const everyMs = SATELLITE_RHYTHM[each.state].beepMs;
      if (!this.lastAt.has(each.key)) {
        this.lastAt.set(each.key, now - everyMs * (1 - (hashString(each.key) % 100) / 100));
      }
      return { key: each.key, everyMs, lastAt: this.lastAt.get(each.key) ?? now };
    });
    const key = nextBeep(beepers, now, this.lastAnyAt);
    const satellite = this.satellites.find((each) => each.key === key);
    if (!satellite) return;
    this.lastAt.set(satellite.key, now);
    this.lastAnyAt = now;
    this.beep(satellite);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
