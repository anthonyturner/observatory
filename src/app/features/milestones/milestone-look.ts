import { DueState } from '../../core/milestones/milestones-report';

/**
 * The tokens.css colour each due state is drawn in, reddening as a date
 * nears and passes: blue while there is time, amber within a week, red once
 * overdue, green when nothing is left open. Reused from the other skies
 * rather than added, since every token is in the start-up stylesheet.
 */
export const DUE_TOKEN: Readonly<Record<DueState, string>> = {
  later: 'flow',
  soon: 'meh',
  overdue: 'actions-failed',
  done: 'actions-passed',
  'open-ended': 'muted',
};

export const DUE_STATES: readonly DueState[] = ['later', 'soon', 'overdue', 'done', 'open-ended'];

/** The lanes, in the Actions sky's lane colour. */
export const LANE_TOKEN = 'actions-lane';

/** A due state's colour as CSS, for the marks and lists laid over the sky. */
export const dueColour = (state: DueState): string => `var(--${DUE_TOKEN[state]})`;
