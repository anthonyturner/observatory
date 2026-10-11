import { HOLE, WorldPoint } from '../engine/black-hole';
import {
  Acts,
  CueScene,
  ExitEvent,
  PathStop,
  delayOf,
  firstActProgress,
  fromOf,
  panAt,
  pathStops,
  secondActProgress,
  spanOf,
} from './departure-exit';

/* How a closed pull request leaves: nothing merged, so its star cools to an
   ember and sinks into the black hole. Both skies and the sound read the same
   rule from here. */

/** The cooling's length, then the sink's, in seconds. */
export const COOL_S = 1.0;
export const SINK_S = 1.8;
export const EMBER_ACTS: Acts = { firstS: COOL_S, secondS: SINK_S };
export const EMBER_SPAN_S = spanOf(EMBER_ACTS);

/** How far through the cooling a burst is: null before it and after it. */
export const coolProgress = (p: number): number | null => firstActProgress(p, EMBER_ACTS);

/** How far through the sink a burst is: 0 until the star has cooled. */
export const sinkProgress = (p: number): number => secondActProgress(p, EMBER_ACTS);

/** A star's last light, and the ember it settles to; the ember matches the Spiral of Done's closed lights. */
const LAST_LIGHT = [255, 227, 184] as const;
const EMBER = [224, 138, 106] as const;

/** The colour of a star `cooled` of the way (0 to 1) from its last light to an ember. */
export function emberColour(cooled: number): string {
  const share = Math.min(1, Math.max(0, cooled));
  const channels = LAST_LIGHT.map((hot, i) => Math.round(hot + (EMBER[i] - hot) * share));
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** What the ember looks like: a radius in star sizes, an opacity, and a colour. */
export interface EmberLook {
  readonly radius: number;
  readonly alpha: number;
  readonly colour: string;
}

/** The star at `q` through its cooling: it contracts and dulls but does not go out. A still sky keeps this alone. */
export const coolLook = (q: number): EmberLook => ({
  radius: 1.5 - 0.6 * q,
  alpha: 0.9 - 0.2 * q,
  colour: emberColour(q),
});

/** The ember falls in over this much of the sink before it fades into the shadow. */
const FADE_FROM = 0.55;
/** How far round the hole, in radians, the ember turns on its way in. */
const SINK_TURN = 1.4;

/** The ember at `s` through its sink: smaller and, near the end, fading into the shadow. */
export function sinkLook(s: number): EmberLook {
  const fade = Math.min(1, Math.max(0, (s - FADE_FROM) / (1 - FADE_FROM)));
  return { radius: 0.9 * (1 - 0.65 * s), alpha: 0.7 * (1 - fade), colour: emberColour(1) };
}

/**
 * Where the ember is in the world at `s` through its sink: drawn in and turned
 * about the hole, quicker as it falls, ending at the hole's centre in its plane.
 */
export function sinkHead(from: WorldPoint, s: number): WorldPoint {
  const dx = from.x - HOLE.x;
  const dy = from.y - HOLE.y;
  const fallen = s * s;
  const angle = Math.atan2(dy, dx) + SINK_TURN * fallen;
  const radius = Math.hypot(dx, dy) * (1 - fallen);
  return {
    x: HOLE.x + Math.cos(angle) * radius,
    y: HOLE.y + Math.sin(angle) * radius,
    z: from.z * (1 - fallen),
  };
}

/** The ember's sound: when the cooling starts, where it sits, and the path of the sink. */
export interface SinkCue {
  /** Seconds until the cooling starts. */
  readonly delayS: number;
  /** -1 left to 1 right. */
  readonly pan: number;
  /** The sink's path as the sky draws it, from the sink's start; empty when motion is off and nothing sinks. */
  readonly sink: readonly PathStop[];
}

/** The ember-sink for a closed pull request: a hush as the star cools, then a low tone that follows it down. */
export function sinkCue(ev: ExitEvent, scene: CueScene): SinkCue {
  const from = fromOf(ev);
  return {
    delayS: delayOf(ev, scene),
    pan: panAt(scene.project(from.x, from.y, from.z).x, scene.width),
    sink: scene.frozen ? [] : pathStops((s) => sinkHead(from, s), SINK_S, scene),
  };
}
