import { CoreState } from './core-states';

/** A colour as three channels, 0 to 1. */
export type Rgb = readonly [number, number, number];

/** What the ball shows now: its state's look, eased toward rather than cut to. */
export interface CoreLook {
  readonly tint: Rgb;
  readonly glow: number;
  readonly ripple: number;
  /** The ball's turn so far, in radians. */
  readonly spin: number;
  /** Its brightness this frame: the glow, pulsing as it breathes. */
  readonly level: number;
  readonly time: number;
  readonly wall: number;
}

export interface LookInput {
  readonly state: CoreState;
  /** The state's tint, resolved from its token. */
  readonly tint: Rgb;
  /** Scene seconds, which stop while the core is still. */
  readonly time: number;
  /** Real seconds, for easing. */
  readonly wall: number;
  readonly isStill: boolean;
}

/** How quickly a change of state settles: about a quarter of a second to most of the way. */
const SETTLE_RATE = 4;
/** One turn of the ball takes this long at a state's `turn` of 1. */
const SPIN_PERIOD_S = 90;
/** One turn of the tier ring takes this long at a `turn` of 1. */
const TIER_PERIOD_S = 360;
/** Capped, so a core back from off screen does not spin round to catch up. */
const MAX_SPIN_STEP_S = 0.25;
const PULSE_DEPTH = 4;

const TAU = Math.PI * 2;

/** The next frame's look. A still core, or the first frame, takes the state's look at once. */
export function nextLook(previous: CoreLook | null, input: LookInput): CoreLook {
  const { state, isStill } = input;
  const settle =
    isStill || !previous ? 1 : 1 - Math.exp(-Math.max(0, input.wall - previous.wall) * SETTLE_RATE);
  const toward = (from: number, to: number): number => from + (to - from) * settle;
  const glow = toward(previous?.glow ?? state.glow, state.glow);
  const step = previous ? Math.min(MAX_SPIN_STEP_S, Math.max(0, input.time - previous.time)) : 0;
  const pulse = isStill
    ? 1
    : 1 + PULSE_DEPTH * state.breathe * Math.sin((input.time / state.period) * TAU);
  return {
    tint: mixRgb(previous?.tint ?? input.tint, input.tint, settle),
    glow,
    ripple: toward(previous?.ripple ?? 0, isStill ? 0 : state.ripple),
    spin: (previous?.spin ?? 0) + step * (TAU / SPIN_PERIOD_S) * state.turn,
    level: glow * pulse,
    time: input.time,
    wall: input.wall,
  };
}

function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  const channel = (i: number): number => from[i] + (to[i] - from[i]) * amount;
  return [channel(0), channel(1), channel(2)];
}

/** The ball's size as it breathes, about 1. */
export const breathing = (state: CoreState, time: number): number =>
  1 + state.breathe * Math.sin((time / state.period) * TAU);

/** How far the tier ring has turned. */
export const tierSpin = (state: CoreState, time: number): number =>
  time * (TAU / TIER_PERIOD_S) * state.turn;

/** How bright a point `distance` from the centre runs while the network
 *  ripples: a band that travels out from the centre. */
export const rippleAt = (distance: number, time: number, ripple: number): number =>
  ripple * Math.pow(0.5 + 0.5 * Math.sin(distance * 16 - time * 5), 8);
