import { seededRandom } from '../instrument/seeded-random';
import { ProjectSnapshot } from '../projects/project.types';
import { compareProjects, severityOf } from '../projects/severity';

/** One project as a world in the system, with everything about it that does
 *  not change from frame to frame. Distances are in orrery units. */
export interface OrreryWorld {
  readonly project: ProjectSnapshot;
  /** The severity colour, as a CSS expression the painter resolves. */
  readonly color: string;
  readonly orbit: number;
  readonly radius: number;
  /** Where on its orbit it starts, in radians. */
  readonly angle: number;
  /** Radians per scene second. */
  readonly speed: number;
  /** How far its orbit leans from the common plane. */
  readonly tilt: number;
  readonly spin: number;
  /** Branches that no longer merge. */
  readonly hasRing: boolean;
  /** One per blocked pull request. */
  readonly moons: number;
  /** Unclaimed issues, on a log scale. */
  readonly comets: number;
  /** Seconds after the system appears that this world grows in. */
  readonly delay: number;
}

/** The innermost orbit, clear of the sun. */
const FIRST_ORBIT = 200;
/** Distance is neglect: each idle day moves a world this far out... */
const ORBIT_PER_IDLE_DAY = 7.6;
/** ...up to this many days, so one abandoned project cannot empty the middle. */
const MAX_IDLE_DAYS = 70;
/** Worlds of equal idleness still need their own lanes. */
const ORBIT_PER_RANK = 28;
/** An empty world is still a world. */
const BASE_RADIUS = 14;
const RADIUS_PER_ROOT_OPEN = 7.6;
/** Kepler, loosely: outer worlds take longer to come round. */
const INNER_SPEED = 0.5 * 0.22;
const KEPLER_POWER = 1.5;
const MAX_TILT = 0.17;
const MAX_MOONS = 6;
const MAX_COMETS = 5;
const FIRST_DELAY = 0.25;
const DELAY_PER_WORLD = 0.16;

/** A stable number from a string, so a world keeps its place across reloads. */
export function hashString(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Comets for unclaimed issues: one for a handful, five for a backlog. */
export const cometCount = (unclaimed: number): number =>
  unclaimed > 0 ? Math.min(MAX_COMETS, Math.ceil(Math.log2(unclaimed + 1))) : 0;

/** Every project as a world, most urgent first so the worst sit innermost. */
export function layoutWorlds(projects: readonly ProjectSnapshot[]): OrreryWorld[] {
  return [...projects].sort(compareProjects).map((project, rank) => {
    const random = seededRandom(hashString(project.repo));
    const idleDays = Math.min(project.oldestIdleDays ?? 0, MAX_IDLE_DAYS);
    const orbit = FIRST_ORBIT + idleDays * ORBIT_PER_IDLE_DAY + rank * ORBIT_PER_RANK;
    const { conflicted, failing, unclaimed } = project.counts;
    return {
      project,
      color: severityOf(project).color,
      orbit,
      radius: BASE_RADIUS + Math.sqrt(project.open) * RADIUS_PER_ROOT_OPEN,
      angle: random() * Math.PI * 2,
      speed: INNER_SPEED / Math.pow(orbit / FIRST_ORBIT, KEPLER_POWER),
      tilt: (random() - 0.5) * 2 * MAX_TILT,
      spin: random() * Math.PI * 2,
      hasRing: conflicted > 0,
      moons: Math.min(conflicted + failing, MAX_MOONS),
      comets: cometCount(unclaimed),
      delay: FIRST_DELAY + rank * DELAY_PER_WORLD,
    };
  });
}

/** The furthest orbit, or the first one when there are no worlds. */
export const outermostOrbit = (worlds: readonly OrreryWorld[]): number =>
  worlds.reduce((furthest, world) => Math.max(furthest, world.orbit), FIRST_ORBIT);

/** The sun grows with the open pull requests it carries, up to a point. */
const SUN_BASE_RADIUS = 36;
const SUN_RADIUS_PER_OPEN = 0.5;
const SUN_MAX_OPEN = 80;

export const openTotal = (worlds: readonly OrreryWorld[]): number =>
  worlds.reduce((sum, world) => sum + world.project.open, 0);

export const sunRadius = (worlds: readonly OrreryWorld[]): number =>
  SUN_BASE_RADIUS + Math.min(openTotal(worlds), SUN_MAX_OPEN) * SUN_RADIUS_PER_OPEN;
