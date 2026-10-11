import { Meteor, meteorHeading, meteorLook } from '../engine/meteor-layer';
import { IssuePlanet, MAX_PLANETS, systemTurn } from '../engine/star-system';
import { SYSTEM_TILT } from '../engine/star-system-shaders';
import { Departure, Ending } from './departure';

/* What a leaving star's company does before the star goes. A merged pull
   request's planets glow green and drift off, because the issues they stand
   for are closed; a closed one's (or one whose merge left an issue open) fall
   back into the field. A meteor is pulled into the core, which flares. This
   file says when and where; the Canvas and WebGL skies draw it and the sound
   hears it from here, so they cannot drift apart. All times are seconds after
   the exit starts. */

/** A planet starts this long after the one inside it. */
export const PLANET_STAGGER_S = 0.15;
/** A resolving planet turns green over this long, then drifts off over the next. */
export const GLOW_S = 0.4;
export const DRIFT_S = 0.8;
/** A planet cut loose falls over this long. */
export const FALL_S = 1.0;
/** The meteor starts to be pulled in here, takes this long, and the core flares for the last stretch. */
export const PULL_AT_S = 0.65;
export const PULL_S = 0.8;
export const FLARE_S = 0.2;

const planetsEndS = (MAX_PLANETS - 1) * PLANET_STAGGER_S + Math.max(GLOW_S + DRIFT_S, FALL_S);
const meteorEndS = PULL_AT_S + PULL_S + FLARE_S;

/** How long the company plays: the room an exit holds before its star begins to go. */
export const COMPANY_S = Math.max(planetsEndS, meteorEndS);

/** What becomes of a planet when its pull request leaves. */
export type PlanetFate = 'resolve' | 'fall';

/**
 * A planet resolves when its pull request merged and the issue is one it closed
 * (or nobody has said which it closed, which a merge nearly always means all of).
 * Otherwise it is cut loose: the pull request was closed, or merged without
 * closing that issue.
 */
export const fateOf = (issue: number, ending: Ending | null): PlanetFate =>
  ending?.fate === 'merged' && (ending.closes?.includes(issue) ?? true) ? 'resolve' : 'fall';

/** Planets are drawn this much bigger than the star's own, so they read at the size a gone star is drawn. */
const POP = 2;
/** How far a resolving planet's orbit widens as it drifts off, and how far a falling one drops, in star radii. */
const DRIFT_REACH = 2.5;
const FALL_DROP = 4;

const unit = (x: number): number => Math.min(1, Math.max(0, x));

/** One planet as it is `since` seconds into the exit. Distances are in star radii. */
export interface PlanetPose {
  readonly issue: number;
  /** An index into the planets' tones. */
  readonly tone: number;
  /** Where it is on its orbit, in radians. */
  readonly angle: number;
  readonly orbit: number;
  /** How far it has dropped below its orbit's plane. */
  readonly drop: number;
  readonly size: number;
  /** 0 as itself, 1 fully green. */
  readonly green: number;
  readonly alpha: number;
}

function poseOf(
  planet: IssuePlanet,
  index: number,
  fate: PlanetFate,
  since: number,
  frozen: boolean,
): PlanetPose | null {
  const u = since - index * PLANET_STAGGER_S;
  const base: PlanetPose = {
    issue: planet.issue,
    tone: planet.tone,
    angle: planet.phase + (frozen ? 0 : since * planet.speed),
    orbit: planet.orbit,
    drop: 0,
    size: planet.size * POP,
    green: 0,
    alpha: 1,
  };
  if (fate === 'resolve') {
    const green = unit(u / GLOW_S);
    const gone = unit((u - GLOW_S) / DRIFT_S);
    if (gone >= 1) return null;
    return {
      ...base,
      orbit: frozen ? planet.orbit : planet.orbit * (1 + DRIFT_REACH * gone * gone),
      size: base.size * (1 + 0.5 * green),
      green,
      alpha: 1 - gone,
    };
  }
  // With motion off nothing falls, so a planet that was cut loose is simply not drawn.
  const fallen = unit(u / FALL_S);
  if (frozen || fallen >= 1) return null;
  return {
    ...base,
    drop: FALL_DROP * fallen * fallen,
    size: base.size * (1 - 0.5 * fallen),
    alpha: 1 - fallen,
  };
}

/** Every planet still to be seen `since` seconds into the exit, with what is becoming of it. */
export function planetPoses(
  { system, ending }: Pick<Departure, 'system' | 'ending'>,
  since: number,
  frozen: boolean,
): PlanetPose[] {
  return system.planets.flatMap((planet, index) => {
    const pose = poseOf(planet, index, fateOf(planet.issue, ending), since, frozen);
    return pose ? [pose] : [];
  });
}

/** The turn the departed system's orbits are drawn at: the sky's own, at rest. */
const TURN = systemTurn(0, 0, true);

/** Where a pose stands from its star's centre, `radius` being the star's: x and y on screen, z toward the viewer. */
export function planetOffset(
  pose: Pick<PlanetPose, 'angle' | 'orbit' | 'drop'>,
  radius: number,
): { readonly x: number; readonly y: number; readonly z: number } {
  const ox = Math.cos(pose.angle) * pose.orbit * radius;
  const oy = Math.sin(pose.angle) * pose.orbit * radius * SYSTEM_TILT;
  return {
    x: ox * Math.cos(TURN) - oy * Math.sin(TURN),
    y: ox * Math.sin(TURN) + oy * Math.cos(TURN) + pose.drop * radius,
    z: Math.sin(pose.angle) * pose.orbit * radius,
  };
}

/** A colour `share` (0 to 1) of the way from one hex colour to another. */
export function mixColour(from: string, towards: string, share: number): string {
  const channels = (hex: string): number[] =>
    [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  const [a, b] = [channels(from), channels(towards)];
  const k = unit(share);
  return `#${a
    .map((c, i) =>
      Math.round(c + (b[i] - c) * k)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** The green a resolved issue glows: the sky's merged colour. */
export const RESOLVED_GREEN = '#5fe3a1';

/** A meteor `p` (0 to 1) of the way into the core. */
export interface MeteorPull {
  /** The way it came from, as a unit vector on screen. */
  readonly heading: { readonly x: number; readonly y: number };
  /** Pixels from the core: it falls faster as it comes. */
  readonly distancePx: number;
  readonly tailPx: number;
  readonly brightness: number;
  readonly p: number;
}

/** How far out the pull begins, in pixels. */
const PULL_FROM_PX = 240;

/** The meteor on its way in `since` seconds into the exit, or null before it starts and once it has landed. */
export function meteorPull(meteor: Meteor, since: number): MeteorPull | null {
  const p = (since - PULL_AT_S) / PULL_S;
  if (p <= 0 || p >= 1) return null;
  const { tailPx, brightness } = meteorLook(meteor.commits);
  return {
    heading: meteorHeading(meteor.pr),
    distancePx: PULL_FROM_PX * (1 - p * p),
    tailPx: tailPx * (1 - 0.4 * p),
    brightness,
    p,
  };
}

/** The star's last light while its company plays. */
export interface GhostLook {
  /** In star sizes. */
  readonly radius: number;
  readonly alpha: number;
}

/** Warm white, a shade under the supernova's flash so the flash lands brighter. */
export const GHOST_COLOUR = '#ffeec8';

/** The core `since` seconds in: steady, flaring for a moment as the meteor reaches it. */
export function ghostLook({ system }: Pick<Departure, 'system'>, since: number): GhostLook {
  const landedFor = since - PULL_AT_S - PULL_S;
  const flare = system.meteor && landedFor >= 0 ? (1 - unit(landedFor / FLARE_S)) ** 2 : 0;
  return { radius: 1 + 0.6 * flare, alpha: 0.8 + 0.2 * flare };
}

/** A planet turning green: which issue, and when it starts, in seconds after the exit starts. */
export interface Resolving {
  readonly issue: number;
  /** Its place among the star's planets, innermost first. */
  readonly index: number;
  readonly atS: number;
}

/** The planets that turn green, in the order they do. */
export function resolving({ system, ending }: Pick<Departure, 'system' | 'ending'>): Resolving[] {
  return system.planets.flatMap(({ issue }, index) =>
    fateOf(issue, ending) === 'resolve' ? [{ issue, index, atS: index * PLANET_STAGGER_S }] : [],
  );
}

/** A pull request's issues turning green on the sky, for whoever wants to say so. */
export interface Resolution {
  readonly pr: number;
  /** The issues that resolve, innermost planet first. */
  readonly issues: readonly number[];
  /** When the first turns green, in wall seconds (`performance.now() / 1000`). */
  readonly startAt: number;
}

/** What the news is about, for the hook below. */
interface Resolvable {
  readonly pr: number;
  readonly startAt?: number;
  readonly departure?: Pick<Departure, 'system' | 'ending'>;
}

/**
 * Each started departure whose planets resolve, once, with the instant the first
 * turns green. Planets turn green even when motion is off, so this does not
 * depend on it. A pull request that left with no known ending resolves nothing.
 */
export function resolutionsOf(events: readonly Resolvable[]): Resolution[] {
  return events.flatMap(({ pr, startAt, departure }) => {
    if (startAt == null || !departure) return [];
    const turning = resolving(departure);
    return turning.length
      ? [{ pr, issues: turning.map((each) => each.issue), startAt: startAt + turning[0].atS }]
      : [];
  });
}
