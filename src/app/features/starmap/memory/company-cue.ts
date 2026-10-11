import { strengthOf } from '../engine/meteor-layer';
import { PULL_AT_S, resolving } from './departure-company';
import { CueScene, ExitEvent, fromOf, panAt } from './departure-exit';

/* How a leaving star's company sounds: a chime for each planet that turns
   green, a suction for the meteor pulled into the core. They ride on the exit
   they belong to, so they are counted with it (see `exitCues`) and heard from
   the same side of the screen. */

/** One planet turning green. */
export interface ChimeCue {
  /** Seconds until it turns green. */
  readonly delayS: number;
  /** -1 left to 1 right. */
  readonly pan: number;
  /** Which planet it is, innermost first: each rings its own note. */
  readonly planet: number;
}

/** The meteor being pulled in. */
export interface SuctionCue {
  /** Seconds until the pull begins. */
  readonly delayS: number;
  /** -1 left to 1 right. */
  readonly pan: number;
  /** 0 to 1: how big the change was. */
  readonly strength: number;
}

export interface CompanyCue {
  readonly chimes: readonly ChimeCue[];
  readonly suction: SuctionCue | null;
}

export const NO_COMPANY: CompanyCue = { chimes: [], suction: null };

/**
 * The chimes and the suction for a leaving star: one chime per planet that turns
 * green, when it does, and a suction as the meteor is pulled in. The planets
 * still turn green with motion off, so they still chime; nothing is pulled then,
 * so the suction is left out. Nothing is invented: only what the star carried.
 */
export function companyCue(ev: ExitEvent, scene: CueScene): CompanyCue {
  const { departure, startAt } = ev;
  const system = departure?.system;
  if (!departure || !system || startAt == null) return NO_COMPANY;
  const from = fromOf(ev);
  const pan = panAt(scene.project(from.x, from.y, from.z).x, scene.width);
  const delay = (afterS: number): number => Math.max(0, startAt + afterS - scene.now);
  const { meteor } = system;
  return {
    chimes: resolving({ system, ending: departure.ending }).map(({ index, atS }) => ({
      delayS: delay(atS),
      pan,
      planet: index,
    })),
    suction:
      meteor && !scene.frozen
        ? { delayS: delay(PULL_AT_S), pan, strength: strengthOf(meteor.commits) }
        : null,
  };
}
