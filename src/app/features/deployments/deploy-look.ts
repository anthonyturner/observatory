import { DeployOutcome } from '../../core/deployments/deployments-report';
import { StarType } from '../../shared/gl/star-shader';

/**
 * The tokens.css colour each outcome is drawn in: the Actions sky's, so a live
 * deployment is green as a passed run is, and amber for one still building.
 * Reused rather than added, since every token is in the start-up stylesheet.
 */
export const OUTCOME_TOKEN: Readonly<Record<DeployOutcome, string>> = {
  ready: 'actions-passed',
  building: 'meh',
  failed: 'actions-failed',
  inactive: 'actions-cancelled',
  unknown: 'actions-queued',
};

/** The pads and trails, in the Actions sky's lane colour. */
export const PAD_TOKEN = 'actions-lane';

/** A failure burns as a flaring giant, a build under way as a bright star; the rest rest. */
const TYPE_BY_OUTCOME: Readonly<Record<DeployOutcome, StarType>> = {
  ready: 'calm',
  building: 'bright',
  failed: 'giant',
  inactive: 'veiled',
  unknown: 'veiled',
};

/** An outcome's colour as CSS, for the marks and lists laid over the sky. */
export const outcomeColour = (outcome: DeployOutcome): string => `var(--${OUTCOME_TOKEN[outcome]})`;

/** Which of the review queue's star types a deployment's beacon is drawn as. */
export const beaconStarType = (outcome: DeployOutcome): StarType => TYPE_BY_OUTCOME[outcome];

/** Seconds for one ring to leave a beacon still building. */
const PULSE_PERIOD_S = 2.4;

/** How far through its pulse a building beacon is, 0 to 1, at scene time `time`. */
export function beaconPulse(time: number, seed: number): number {
  const turns = time / PULSE_PERIOD_S + seed;
  return turns - Math.floor(turns);
}
