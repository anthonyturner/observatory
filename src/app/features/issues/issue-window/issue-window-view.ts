import { Issue } from '../../../core/issues/issues-report';
import { formatDay } from '../../../core/logs/log-format';
import { daysSince } from '../issue-list';

/** What the window knows of an issue: the list's row until its own read arrives. */
export type IssueInfo = Partial<Issue> & { readonly number: number };

/** The kicker at the top: it names the kind first, so an issue never passes
 *  for a pull request; its words carry the state, its colour only echoes it. */
export interface Kicker {
  readonly text: string;
  /** The state in a word, such as `Comet`, for the bar a phone pins; null when unknown. */
  readonly state: string | null;
  readonly colour: string;
  /** The words' own ink, when it differs from the window's colour. */
  readonly ink: string | null;
}

/** What this window shows, in the words the pull request screen's "Pull request" mirrors. */
const KIND = 'Issue';

interface StateLook {
  readonly state: string;
  readonly detail: string | null;
  readonly colour: string;
  readonly ink: string | null;
}

const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`;
const isAbandoned = (reason: string | null | undefined): boolean =>
  reason === 'NOT_PLANNED' || reason === 'DUPLICATE';

/** pr-starmap's issue states, first match wins; purple is left out, because it
 *  already means an edit is pending. Null when the row has not said yet. */
function stateLookOf(info: IssueInfo): StateLook | null {
  const { closedAt, stateReason, comet, prs } = info;
  if (closedAt && isAbandoned(stateReason)) {
    const how = stateReason === 'DUPLICATE' ? 'duplicate' : 'not planned';
    return {
      state: 'Closed',
      detail: `${how} · ${formatDay(closedAt)}`,
      colour: 'var(--faint)',
      ink: 'var(--muted)',
    };
  }
  if (closedAt) {
    return {
      state: 'Completed',
      detail: `closed ${formatDay(closedAt)}`,
      colour: 'var(--ok)',
      ink: null,
    };
  }
  if (comet) {
    return {
      state: 'Comet',
      detail: 'no pull request closes it',
      colour: 'var(--count-unclaimed)',
      ink: null,
    };
  }
  if (prs?.length) {
    const detail = `${plural(prs.length, 'pull request')} on it`;
    return { state: 'Open', detail, colour: 'var(--flow)', ink: null };
  }
  return closedAt === null
    ? { state: 'Open', detail: null, colour: 'var(--flow)', ink: null }
    : null;
}

export function kickerOf(info: IssueInfo): Kicker {
  const look = stateLookOf(info);
  if (!look) return { text: KIND, state: null, colour: 'var(--flow)', ink: null };
  const said = look.detail ? `${look.state} — ${look.detail}` : look.state;
  return { text: `${KIND} · ${said}`, state: look.state, colour: look.colour, ink: look.ink };
}

/** "Issue #12 · Open", for the thin bar a phone pins at the top. */
export const barLabelOf = (number: number, kicker: Kicker): string =>
  kicker.state ? `${KIND} #${number} · ${kicker.state}` : `${KIND} #${number}`;

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
