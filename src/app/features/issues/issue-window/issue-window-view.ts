import { Issue } from '../../../core/issues/issues-report';
import { formatDay } from '../../../core/logs/log-format';
import { daysSince } from '../issue-list';

/** What the window knows of an issue: the list's row until its own read arrives. */
export type IssueInfo = Partial<Issue> & { readonly number: number };

/** The kicker at the top: its words carry the state, its colour only echoes it. */
export interface Kicker {
  readonly text: string;
  readonly colour: string;
  /** The words' own ink, when it differs from the window's colour. */
  readonly ink: string | null;
}

const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`;
const isAbandoned = (reason: string | null | undefined): boolean =>
  reason === 'NOT_PLANNED' || reason === 'DUPLICATE';

/** pr-starmap's issue states, first match wins; purple is left out, because it
 *  already means an edit is pending. */
export function kickerOf(info: IssueInfo): Kicker {
  const { closedAt, stateReason, comet, prs } = info;
  if (closedAt && isAbandoned(stateReason)) {
    const how = stateReason === 'DUPLICATE' ? 'duplicate' : 'not planned';
    return {
      text: `Closed — ${how} · ${formatDay(closedAt)}`,
      colour: 'var(--faint)',
      ink: 'var(--muted)',
    };
  }
  if (closedAt) {
    return { text: `Completed — closed ${formatDay(closedAt)}`, colour: 'var(--ok)', ink: null };
  }
  if (comet) {
    return {
      text: 'Comet — no pull request closes it',
      colour: 'var(--count-unclaimed)',
      ink: null,
    };
  }
  if (prs?.length) {
    return {
      text: `Open — ${plural(prs.length, 'pull request')} on it`,
      colour: 'var(--flow)',
      ink: null,
    };
  }
  return { text: closedAt === null ? 'Open' : 'Issue', colour: 'var(--flow)', ink: null };
}

/** "#12 · Open", for the thin bar a phone pins at the top. */
export const barLabelOf = (number: number, kicker: Kicker): string =>
  `#${number} · ${kicker.text.split(' — ')[0]}`;

/** A deleted account comes as null, or as `app/` from the token reader, which
 *  reads an author it cannot place as an app; GitHub shows it as ghost. */
function byWho(author: string | null | undefined): string {
  if (author === undefined) return '';
  return `by @${!author || author === 'app/' ? 'ghost' : author}`;
}

/** "opened Sep 1 by @me · 25 days old · idle 6 days", or when it closed. */
export function metaLineOf(info: IssueInfo, now: number): string {
  const opened = [info.createdAt ? `opened ${formatDay(info.createdAt)}` : '', byWho(info.author)]
    .filter(Boolean)
    .join(' ');
  const meta = [opened];
  if (info.closedAt) {
    meta.push(`closed ${formatDay(info.closedAt)}`);
  } else {
    if (info.createdAt) meta.push(`${plural(daysSince(info.createdAt, now), 'day')} old`);
    const idle = info.updatedAt ? daysSince(info.updatedAt, now) : 0;
    if (idle) meta.push(`idle ${plural(idle, 'day')}`);
  }
  return meta.filter(Boolean).join(' · ');
}
