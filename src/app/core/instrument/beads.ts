import { ProjectSnapshot } from '../projects/project.types';
import { Severity, compareProjects, severityOf } from '../projects/severity';
import { clamp01 } from './easing';
import { ORBIT } from './proportions';
import { Point3, tilt } from './tilt';

/** One project on the orbit. */
export interface Bead extends Point3 {
  readonly key: string;
  readonly project: ProjectSnapshot;
  readonly severity: Severity;
  readonly size: number;
  /** The far side of the ring sits a little dimmer, as it would. */
  readonly dim: number;
  readonly isRinged: boolean;
  /** 0 fresh to 1 long neglected, from the project's oldest untouched PR. */
  readonly staleness: number;
  /** Seconds after the beads are laid out before this one starts to grow. */
  readonly delay: number;
}

/** The projects past MAX_BEADS, drawn as one "+n" mark in the next slot. */
export interface BeadOverflow extends Point3 {
  readonly count: number;
}

export interface BeadLayout {
  readonly beads: readonly Bead[];
  readonly overflow: BeadOverflow | null;
}

export const MAX_BEADS = 24;
/** How much larger the lit project's bead draws. */
export const LIT_BEAD_GROWTH = 1.45;
/** A desktop core is about this radius; beads shrink with a phone's smaller one. */
const FULL_SIZE_RADIUS = 140;
const MIN_SIZE_SCALE = 0.45;
/** Beads shrink once the ring holds more than this many, so they never pile up. */
const ROOMY_COUNT = 10;
const MIN_BEAD = 3;
const MAX_BEAD = 10;
const FIRST_DELAY_S = 0.35;
const DELAY_STEP_S = 0.07;
/** A project starts to fade once its oldest untouched PR is a week old, and
 *  is at its faintest by six weeks. */
const STALE_FROM_DAYS = 7;
const FULLY_STALE_DAYS = 42;
/** How much of its brightness the stalest bead gives up. */
const STALE_DIMMING = 0.55;
/** The stale ring pulses once every few seconds, like a slow reminder. */
const STALE_PULSE_S = 3.5;
/** A still core holds the ring at this much of its strength. */
const STALE_STILL = 0.45;

const isShown = (project: ProjectSnapshot): boolean =>
  project.dashboardUrl !== '' || severityOf(project).id === 'blocked';

/** Beads sit on the orbit in card order, clockwise from twelve o'clock, so
 *  the ring reads blocked first: projects with a star map, and blocked ones
 *  without, up to MAX_BEADS. */
export function layoutBeads(projects: readonly ProjectSnapshot[], coreRadius: number): BeadLayout {
  const all = projects.filter(isShown).sort(compareProjects);
  const shown = all.slice(0, MAX_BEADS);
  const hidden = all.length - shown.length;
  const slots = Math.max(1, shown.length + (hidden > 0 ? 1 : 0));
  const orbit = coreRadius * ORBIT;
  const slotAt = (index: number): Point3 => {
    const angle = (index / slots) * Math.PI * 2;
    return tilt(Math.sin(angle) * orbit, 0, -Math.cos(angle) * orbit);
  };
  const scale =
    Math.min(1, Math.max(MIN_SIZE_SCALE, coreRadius / FULL_SIZE_RADIUS)) *
    Math.sqrt(ROOMY_COUNT / Math.max(ROOMY_COUNT, shown.length));
  const beads = shown.map((project, index): Bead => {
    const at = slotAt(index);
    const severity = severityOf(project);
    return {
      ...at,
      key: project.repo,
      project,
      severity,
      // Grows with open work, floored so an empty project still shows.
      size: Math.min(MIN_BEAD + Math.sqrt(project.open) * 1.25, MAX_BEAD) * scale,
      dim: (0.62 + 0.38 * ((at.z / orbit + 1) / 2)) * (1 - STALE_DIMMING * stalenessOf(project)),
      isRinged: severity.id === 'blocked',
      staleness: stalenessOf(project),
      delay: FIRST_DELAY_S + index * DELAY_STEP_S,
    };
  });
  return { beads, overflow: hidden > 0 ? { ...slotAt(shown.length), count: hidden } : null };
}

/** How neglected a project is, 0 to 1, from its oldest untouched PR's age. */
export function stalenessOf(project: ProjectSnapshot): number {
  const days = project.oldestIdleDays ?? 0;
  return clamp01((days - STALE_FROM_DAYS) / (FULLY_STALE_DAYS - STALE_FROM_DAYS));
}

/** How strongly a stale bead's ring shows at `time`: 0 for a fresh one. */
export function stalePulse(staleness: number, time: number, isStill: boolean): number {
  if (staleness <= 0) return 0;
  if (isStill) return staleness * STALE_STILL;
  return staleness * (0.25 + 0.35 * (0.5 + 0.5 * Math.sin((time * Math.PI * 2) / STALE_PULSE_S)));
}
