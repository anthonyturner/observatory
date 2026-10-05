import { Comet } from './comets';

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
