import { RunOutcome } from '../../../core/actions/actions-report';
import { StarType } from '../../../shared/gl/star-shader';

/** A failure burns as a flaring giant, a run still going as a bright star; the rest rest. */
const TYPE_BY_OUTCOME: Readonly<Record<RunOutcome, StarType>> = {
  failed: 'giant',
  running: 'bright',
  queued: 'veiled',
  passed: 'calm',
  cancelled: 'veiled',
  skipped: 'veiled',
};

/** Which of the review queue's star types a run is drawn as. */
export const runStarType = (outcome: RunOutcome): StarType => TYPE_BY_OUTCOME[outcome];

/** The tokens.css colour each outcome is drawn in. */
export const OUTCOME_TOKEN: Readonly<Record<RunOutcome, string>> = {
  failed: 'actions-failed',
  running: 'actions-running',
  queued: 'actions-queued',
  passed: 'actions-passed',
  cancelled: 'actions-cancelled',
  skipped: 'actions-cancelled',
};

const TAU = Math.PI * 2;
/** Seconds for one breath of a failure's flare, and how far it swells. */
const FLARE_PERIOD_S = 3.2;
const FLARE_SWELL = 0.35;
/** Seconds for one ring to leave a running star. */
const PULSE_PERIOD_S = 2.4;
/** A queued run pulses slower: waiting, not working. */
const QUEUED_PERIOD_S = 4.8;

/** An outcome's colour as CSS, for the marks and lists laid over the sky. */
export const outcomeColour = (outcome: RunOutcome): string => `var(--${OUTCOME_TOKEN[outcome]})`;

/** Each star keeps its own phase, so a sky of failures does not breathe in step. */
export const phaseSeed = (id: number): number => ((id * 2654435761) >>> 0) / 2 ** 32;

/** A failure's flare at scene time `time`: its reach as a multiple of the star, 1 to 1 + swell. */
export function flareReach(time: number, seed: number): number {
  return 1 + FLARE_SWELL * (0.5 + 0.5 * Math.sin((time / FLARE_PERIOD_S + seed) * TAU));
}

/** How far through its pulse a run still going is, 0 to 1, at scene time `time`. */
export function pulsePhase(outcome: RunOutcome, time: number, seed: number): number {
  const period = outcome === 'queued' ? QUEUED_PERIOD_S : PULSE_PERIOD_S;
  const turns = time / period + seed;
  return turns - Math.floor(turns);
}

/** Runs that pulse: the ones not finished yet. */
export const isOpen = (outcome: RunOutcome): boolean =>
  outcome === 'running' || outcome === 'queued';
