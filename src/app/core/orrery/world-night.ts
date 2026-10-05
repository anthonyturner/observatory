import { ProjectSnapshot } from '../projects/project.types';

/** Open pull requests that light a night side fully. */
const FULL_LIGHTS_OPEN = 10;
/** Days idle after which a world's lights are at their dimmest. */
const DARK_AFTER_DAYS = 30;
/** How much of its light a stale world keeps. */
const STALE_FLOOR = 0.2;
/** A single failing check already smoulders; each more burns brighter. */
const FIRST_UNREST = 0.4;
const UNREST_PER_FAILURE = 0.2;

/** What a world's night side shows, each between 0 and 1. */
export interface NightSide {
  /** City lights: work in motion. */
  readonly lights: number;
  /** Glowing fissures: checks failing. */
  readonly unrest: number;
}

/** More open pull requests, more lights, dimming as the oldest goes stale;
 *  fissures only while checks fail. */
export function nightSide(project: ProjectSnapshot): NightSide {
  const busy = Math.min(project.open / FULL_LIGHTS_OPEN, 1);
  const staleness = Math.min(project.oldestIdleDays ?? 0, DARK_AFTER_DAYS) / DARK_AFTER_DAYS;
  const { failing } = project.counts;
  return {
    lights: busy * (1 - staleness * (1 - STALE_FLOOR)),
    unrest: failing > 0 ? Math.min(FIRST_UNREST + (failing - 1) * UNREST_PER_FAILURE, 1) : 0,
  };
}
