import { Issue } from '../../core/issues/issues-report';
import { COMET_COLOUR, OTHER_ARM, SETTLED_COLOUR } from './issue-inks';

/** How an issue looks in the nursery: nobody on it, work on it, finished, or abandoned. */
export type Look = 'globule' | 'protostar' | 'settled' | 'dust';

/** An issue as its body in the nursery shows it. */
export interface IssueStar {
  readonly issue: Issue;
  readonly look: Look;
  /** The open pull requests on it. */
  readonly jets: readonly number[];
  /** Its arm's colour. */
  readonly colour: string;
}

const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`;

function dustWords(reason: string | null): string {
  if (reason === 'NOT_PLANNED') return 'closed as not planned';
  if (reason === 'DUPLICATE') return 'closed as a duplicate';
  return 'closed, no reason recorded';
}

/** The card's kicker: what the body is, in pr-starmap's words. */
export function lookWords(star: IssueStar): string {
  switch (star.look) {
    case 'globule':
      return 'Globule — nobody on it';
    case 'protostar':
      return `Protostar — ${plural(star.jets.length, 'pull request')} on it`;
    case 'settled':
      return 'Settled — closed as completed';
    case 'dust':
      return `Dust — ${dustWords(star.issue.stateReason)}`;
  }
}

/** The card's colour: the body's own. */
export function lookColour(star: IssueStar): string {
  if (star.look === 'globule') return COMET_COLOUR;
  if (star.look === 'settled') return SETTLED_COLOUR;
  return star.look === 'dust' ? OTHER_ARM : star.colour;
}

/** One line of the card's facts, as the pull request card writes them. */
export interface IssueFact {
  readonly term: string;
  readonly value: string;
  /** In the card's own colour. */
  readonly isHot: boolean;
}

const DAY_MS = 86_400_000;
/** Idle past this many days reads hot. */
const HOT_IDLE_DAYS = 30;
const daysSince = (iso: string, now: number): number =>
  Math.max(0, Math.floor((now - Date.parse(iso)) / DAY_MS));

/** The card's facts, in pr-starmap's order and words. */
export function issueFacts(star: IssueStar, now: number, day: (iso: string) => string): IssueFact[] {
  const { issue, jets } = star;
  const idle = daysSince(issue.updatedAt, now);
  const facts: IssueFact[] = [
    issue.closedAt
      ? { term: 'closed', value: day(issue.closedAt), isHot: false }
      : { term: 'idle', value: `${idle} days`, isHot: idle > HOT_IDLE_DAYS },
    { term: 'age', value: `${daysSince(issue.createdAt, now)} days`, isHot: false },
  ];
  if (jets.length > 1) {
    facts.push({
      term: 'twins',
      value: `${jets.length} open pull requests close it — likely the same work twice`,
      isHot: true,
    });
  }
  return facts;
}
