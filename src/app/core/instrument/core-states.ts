/** The core is the assistant's body; its state says what the assistant is doing. */
export type CoreStateId =
  | 'idle'
  | 'routing'
  | 'answered-1'
  | 'answered-2'
  | 'answered-3'
  | 'error'
  | 'listening'
  | 'transcribing'
  | 'speaking'
  | 'running';

/** A colour the core draws in, named by its token in tokens.css. */
export type CoreInk =
  | '--core-idle'
  | '--core-routing'
  | '--core-error'
  | '--core-listening'
  | '--core-transcribing'
  | '--core-speaking'
  | '--core-uneasy'
  | '--core-unknown';

export type TierLevels = readonly [number, number, number];

/** What a state's tier arcs are lit by. */
export interface TierMoment {
  /** Scene seconds. */
  readonly time: number;
  /** Seconds since the core entered this state. */
  readonly age: number;
  readonly isStill: boolean;
  /** The tier of the reply being spoken, 0 to 2. */
  readonly spokenTier: number;
}

/** `tint` and `glow` are what a still core shows, so every state must read
 *  by colour and brightness alone. `breathe` and `period` are its pulse,
 *  `turn` its spin and `ripple` a wave out through the network. `swell` is how
 *  much brighter it grows with the voice at full level: the mic while it
 *  listens, the reply while it speaks. */
export interface CoreState {
  readonly tint: CoreInk;
  readonly glow: number;
  readonly breathe: number;
  readonly period: number;
  readonly turn: number;
  readonly ripple: number;
  readonly swell?: number;
  readonly tiers: (moment: TierMoment) => TierLevels;
}

const tiersOf = (level: (tier: number) => number): TierLevels => [level(0), level(1), level(2)];
const steady = (level: number) => (): TierLevels => [level, level, level];

/** The tier a reply took flares, then holds. */
const answered = (lit: number): CoreState => ({
  tint: '--core-idle',
  glow: 1.1,
  breathe: 0.03,
  period: 6,
  turn: 1,
  ripple: 0,
  tiers: ({ age, isStill }) =>
    tiersOf((tier) =>
      tier !== lit ? 0.14 : isStill ? 1 : 0.75 + 0.25 * Math.max(0, 1 - age / 0.8),
    ),
});

export const CORE_STATES: Readonly<Record<CoreStateId, CoreState>> = {
  idle: {
    tint: '--core-idle',
    glow: 1,
    breathe: 0.03,
    period: 6,
    turn: 1,
    ripple: 0,
    tiers: steady(0.2),
  },
  // Working out a request: the three arcs light in turn; still, all sit at half.
  routing: {
    tint: '--core-routing',
    glow: 1.25,
    breathe: 0.02,
    period: 2,
    turn: 2.5,
    ripple: 1,
    tiers: ({ time, isStill }) =>
      isStill
        ? [0.5, 0.5, 0.5]
        : tiersOf((tier) => 0.22 + 0.7 * Math.max(0, Math.sin(time * 5 - tier * 2.1))),
  },
  'answered-1': answered(0),
  'answered-2': answered(1),
  'answered-3': answered(2),
  error: {
    tint: '--core-error',
    glow: 0.95,
    breathe: 0.02,
    period: 6,
    turn: 0.5,
    ripple: 0,
    tiers: steady(0.12),
  },
  listening: {
    tint: '--core-listening',
    glow: 1.45,
    breathe: 0.05,
    period: 1.2,
    turn: 1,
    ripple: 0,
    swell: 0.5,
    tiers: steady(0.1),
  },
  transcribing: {
    tint: '--core-transcribing',
    glow: 1.3,
    breathe: 0.03,
    period: 2,
    turn: 1,
    ripple: 0.6,
    tiers: steady(0.1),
  },
  // The arc of the reply being read stays lit.
  speaking: {
    tint: '--core-speaking',
    glow: 1.35,
    breathe: 0.02,
    period: 3,
    turn: 1,
    ripple: 0,
    swell: 0.6,
    tiers: ({ spokenTier }) => tiersOf((tier) => (tier === spokenTier ? 1 : 0.14)),
  },
  // A task running, which can take half an hour: the tier-3 arc pulses; still, it holds lit.
  running: {
    tint: '--core-routing',
    glow: 1.15,
    breathe: 0.03,
    period: 4,
    turn: 1.6,
    ripple: 0.35,
    tiers: ({ time, isStill }) => [
      0.14,
      0.14,
      isStill ? 1 : 0.5 + 0.45 * (0.5 + 0.5 * Math.sin((time * Math.PI) / 2)),
    ],
  },
};

/** Every ink the palette resolves: the states' own, and the two the mood blends toward. */
export const CORE_INKS: readonly CoreInk[] = [
  ...new Set(Object.values(CORE_STATES).map((state) => state.tint)),
  '--core-uneasy',
  '--core-unknown',
];
