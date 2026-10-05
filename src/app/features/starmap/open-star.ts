import { Comet } from './comets';
import { Chart } from './engine/sky-frame';
import { TetherTarget } from './engine/tether-layer';

/** What is open over the sky: a star's card, a PR screen, an issue window. */
export interface OpenOverSky {
  readonly card: number | null;
  readonly sheet: number | null;
  readonly issue: number | null;
}

/** A pull request as the ring looks for it: its number and the issues it closes. */
export interface RingedPull {
  readonly number: number;
  readonly closes: readonly number[];
}

/**
 * The pull request the queue sky rings: the open screen's, then one that
 * closes the open issue (the card's, when it is one), then the card's.
 */
export function ringedPull(open: OpenOverSky, pulls: readonly RingedPull[]): number | null {
  if (open.sheet !== null) return open.sheet;
  const issue = open.issue;
  const closers = pulls.filter((pull) => issue !== null && pull.closes.includes(issue));
  if (closers.some((pull) => pull.number === open.card)) return open.card;
  return closers[0]?.number ?? open.card;
}

/** The comet the queue sky rings: the open issue's, else the picked one. */
export function ringedComet(
  issue: number | null,
  comets: readonly Comet[],
  picked: Comet | null,
): Comet | null {
  return comets.find((comet) => comet.issue === issue) ?? picked;
}

/**
 * What the open window is tied to on the sky: the ringed star or comet, or
 * nothing when its own star is not the one ringed there.
 */
export function tetherOf(
  chart: Chart,
  open: OpenOverSky,
  pulls: readonly RingedPull[],
  comets: readonly Comet[],
): TetherTarget | null {
  const issue = open.issue;
  if (chart === 'issues') return issue !== null && open.sheet === null ? 'star' : null;
  if (chart !== 'prs') return null;
  if (open.sheet !== null) return 'star';
  if (issue === null) return null;
  if (comets.some((comet) => comet.issue === issue)) return 'comet';
  return pulls.some((pull) => pull.closes.includes(issue)) ? 'star' : null;
}
