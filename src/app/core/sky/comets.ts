import { clamp01 } from '../instrument/easing';
import { DEG } from '../instrument/proportions';
import { seededRandom } from '../instrument/seeded-random';
import { ProjectSnapshot } from '../projects/project.types';
import { compareProjects, severityOf } from '../projects/severity';

/* A rain of comets, one per open issue. Each falls on a loop of its own, so
   the rain gets heavier as issues pile up and thins as they are closed. A
   comet takes its project's colour, the same as the project's bead. */

export interface Comet {
  /** The project's repo, and which of its issues this comet stands for. */
  readonly key: string;
  /** The project's severity colour, as CSS. */
  readonly colour: string;
  /** How often it falls, and where in that loop it starts, in seconds. */
  readonly periodS: number;
  readonly offsetS: number;
  /** 0 to 1: where along the top edge (and the side it comes in from) it enters. */
  readonly entry: number;
  /** Radians off straight down, falling down and to the left. */
  readonly slant: number;
  readonly speedPx: number;
  readonly lengthPx: number;
  readonly widthPx: number;
  readonly brightness: number;
}

/** Where a comet in flight is now, in screen pixels. */
export interface CometFlight {
  readonly headX: number;
  readonly headY: number;
  readonly tailX: number;
  readonly tailY: number;
  readonly alpha: number;
}

export interface SkySize {
  readonly width: number;
  readonly height: number;
}

/** The most comets the sky draws, however many issues are open. */
export const MAX_COMETS = 600;
const MIN_PERIOD_S = 12;
const PERIOD_SPREAD_S = 18;
const BASE_SLANT = 24 * DEG;
const SLANT_SPREAD = 8 * DEG;
const MIN_SPEED_PX = 420;
const SPEED_SPREAD_PX = 480;
const MIN_LENGTH_PX = 90;
const LENGTH_SPREAD_PX = 170;
/** The first and last parts of a flight fade in and out, so no comet pops. */
const FADE_IN = 0.12;
const FADE_OUT = 0.3;

/** One comet per open issue across the projects GitHub could read, worst
 *  project first, up to MAX_COMETS. A comet is seeded from its project and
 *  issue number, so one more issue adds one comet and moves none. */
export function cometsFor(projects: readonly ProjectSnapshot[]): Comet[] {
  const comets: Comet[] = [];
  const readable = projects.filter((project) => !project.error && (project.issues ?? 0) > 0);
  for (const project of [...readable].sort(compareProjects)) {
    const colour = severityOf(project).color;
    for (let issue = 0; issue < (project.issues ?? 0) && comets.length < MAX_COMETS; issue++) {
      comets.push(cometOf(`${project.repo}#${issue}`, colour));
    }
  }
  return comets;
}

function cometOf(key: string, colour: string): Comet {
  const random = seededRandom(hashOf(key));
  const periodS = MIN_PERIOD_S + random() * PERIOD_SPREAD_S;
  return {
    key,
    colour,
    periodS,
    offsetS: random() * periodS,
    entry: random(),
    slant: BASE_SLANT + (random() * 2 - 1) * SLANT_SPREAD,
    speedPx: MIN_SPEED_PX + random() * SPEED_SPREAD_PX,
    lengthPx: MIN_LENGTH_PX + random() * LENGTH_SPREAD_PX,
    widthPx: 1 + random() * 1.2,
    brightness: 0.5 + random() * 0.45,
  };
}

/** Where `comet` is at scene time `time`, or null between its falls. It
 *  enters above the top edge, or off the right side, and leaves past the
 *  bottom, so the whole sky is covered whatever its shape. */
export function flightAt(comet: Comet, time: number, size: SkySize): CometFlight | null {
  const dx = -Math.sin(comet.slant);
  const dy = Math.cos(comet.slant);
  const drift = size.height * Math.tan(comet.slant);
  const startX = comet.entry * (size.width + drift);
  const startY = -comet.lengthPx;
  const travel = (size.height + comet.lengthPx * 2) / dy;
  const flightS = travel / comet.speedPx;
  const phase = (((time + comet.offsetS) % comet.periodS) + comet.periodS) % comet.periodS;
  if (phase > flightS) return null;
  const progress = phase / flightS;
  const gone = phase * comet.speedPx;
  const headX = startX + dx * gone;
  const headY = startY + dy * gone;
  const fade = Math.min(clamp01(progress / FADE_IN), clamp01((1 - progress) / FADE_OUT));
  return {
    headX,
    headY,
    tailX: headX - dx * comet.lengthPx,
    tailY: headY - dy * comet.lengthPx,
    alpha: comet.brightness * fade,
  };
}

/** FNV-1a: a small, stable hash, so a comet's seed follows its key. */
function hashOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
