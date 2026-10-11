import { panOf } from '../engine/meteor-layer';
import { NewsEvent } from './news';
import { DEPARTED_MAG } from './departure-exit';

/* How a leaving star's company goes home. A crew ship and each satellite at a
   star that left the sky cast off one after another, a beat after its exit
   starts; the crew flies off as it does when its run ends, the satellites fly to
   the parking orbit. Both skies, the engine's sound and whoever wants to speak
   a farewell read the same schedule from here. */

export type UndockKind = 'crew' | 'satellite';

/** One ship or satellite casting off from a star that left. */
export interface Undock {
  readonly kind: UndockKind;
  /** The satellite's own key; a crew has one ship per pull request. */
  readonly key: string;
  readonly pr: number;
  /** What to call it: the agent's name, or "Crew". */
  readonly name: string;
  /** Where its star stood, in the world. */
  readonly from: { readonly x: number; readonly y: number; readonly z: number };
  /** The moment it casts off, in wall seconds (`performance.now() / 1000`). */
  readonly startAt: number;
}

/** How long each flies once it has cast off, in seconds. */
export const FLIGHT_S: Readonly<Record<UndockKind, number>> = { crew: 4, satellite: 2.6 };

/** The first casts off this long after its star's exit starts, then one every `STEP_S`. */
const FIRST_LAG_S = 0.3;
const STEP_S = 0.18;
/** More engines than this in one refresh is mud, so the rest fly silent. */
const MAX_ENGINES = 4;

/** The size of a star that is no longer in the sky, as the exit draws it. */
export const departedRadius = (scale: number): number => DEPARTED_MAG * Math.max(scale, 0.42);

/**
 * Everyone that casts off for these events: for each pull request that left
 * with a departure, its crew ship if the crew was still at work, then its
 * satellites. A crew back from its run has already flown, so it has no ship to
 * send. Only events the sky has started playing have a time to cast off at.
 */
export function undocksOf(events: readonly NewsEvent[]): Undock[] {
  return events.flatMap((event) => {
    const { startAt, departure } = event;
    if (startAt == null || !departure) return [];
    const { crew, satellites } = departure.system;
    const from = { x: event.fromX ?? 0, y: event.fromY ?? 0, z: event.fromZ ?? 0 };
    const leaving = [
      ...(crew?.phase === 'working'
        ? [{ kind: 'crew' as const, key: `crew:${event.pr}`, name: 'Crew' }]
        : []),
      ...satellites.map(({ key, name }) => ({ kind: 'satellite' as const, key, name })),
    ];
    return leaving.map((each, i) => ({
      ...each,
      pr: event.pr,
      from,
      startAt: startAt + FIRST_LAG_S + i * STEP_S,
    }));
  });
}

/** Where one is in its leaving: waiting at the star, on its way, or home. */
export interface Flight {
  readonly stage: 'docked' | 'flying' | 'home';
  /** 0 to 1 through the flight. */
  readonly p: number;
  /** Seconds since it cast off; negative while it waits. */
  readonly since: number;
}

export function flightOf(
  { kind, startAt }: Pick<Undock, 'kind' | 'startAt'>,
  wall: number,
): Flight {
  const since = wall - startAt;
  if (since < 0) return { stage: 'docked', p: 0, since };
  const p = since / FLIGHT_S[kind];
  return p < 1 ? { stage: 'flying', p, since } : { stage: 'home', p: 1, since };
}

/** Those still to cast off or on their way: the ones that are home are the sky's as usual. */
export const stillAway = (undocks: readonly Undock[], wall: number): Undock[] =>
  undocks.filter((undock) => flightOf(undock, wall).stage !== 'home');

/** A point `p` of the way between two, leaving slowly, cruising and arriving slowly. */
export function flightPoint(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  p: number,
): { x: number; y: number } {
  const eased = p * p * (3 - 2 * p);
  return { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
}

/** The engine for one cast-off: when it fires and where it sits between the speakers. */
export interface UndockCue {
  readonly kind: UndockKind;
  readonly delayS: number;
  /** -1 left to 1 right. */
  readonly pan: number;
}

/**
 * The engine for each cast-off, no more than four: heard as it casts off, from
 * the side of the screen its star stood on. With motion off nothing flies, so
 * nothing is heard.
 */
export function undockCues(
  undocks: readonly Undock[],
  {
    now,
    width,
    frozen,
    project,
  }: {
    now: number;
    width: number;
    frozen: boolean;
    /** Where a world point is on screen. */
    project: (x: number, y: number, z: number) => { readonly x: number };
  },
): UndockCue[] {
  if (frozen) return [];
  return undocks.slice(0, MAX_ENGINES).map(({ kind, from, startAt }) => ({
    kind,
    delayS: Math.max(0, startAt - now),
    pan: panOf(project(from.x, from.y, from.z).x, width),
  }));
}
