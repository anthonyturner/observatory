import { IssuesState } from '../../core/issues/issues-feed';
import { IssueItem } from '../../core/issues/issues-report';
import { hoursMinutes, localDayKey } from '../../core/usage/usage-format';

export type IssueGroupId = 'unclaimed' | 'claimed';

/** One group of the Issues tab. */
export interface IssueGroup {
  readonly id: IssueGroupId;
  readonly title: string;
  readonly meaning: string;
  readonly color: string;
  readonly items: readonly IssueItem[];
}

const GROUPS: readonly Omit<IssueGroup, 'items'>[] = [
  {
    id: 'unclaimed',
    title: 'Nobody on it',
    meaning: 'no open pull request closes it',
    color: 'var(--count-unclaimed)',
  },
  {
    id: 'claimed',
    title: 'In progress',
    meaning: 'an open pull request says it closes it',
    color: 'var(--count-unreviewed)',
  },
];

/** Does the issue match what was typed: its title, `#number`, a label or an assignee. */
export function issueMatches(item: IssueItem, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = [
    item.title,
    `#${item.number}`,
    String(item.number),
    ...item.labels,
    ...item.assignees,
  ]
    .join(' ')
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/** The groups in order, narrowed by the search, leaving out empty ones. */
export function issueGroups(items: readonly IssueItem[], query: string): IssueGroup[] {
  const matching = items.filter((item) => issueMatches(item, query));
  return GROUPS.map((group) => ({
    ...group,
    items: matching.filter((item) => item.pulls.length > 0 === (group.id === 'claimed')),
  })).filter((group) => group.items.length > 0);
}

const UNREAD: Record<Exclude<IssuesState['status'], 'ready'>, string> = {
  reading: 'reading the issues',
  unreachable: 'API out of reach',
};

/** "9 open · 7 nobody on · 3 closed in 30 days · refreshed 09:42". */
export function issuesStamp(state: IssuesState, now: number, locale?: string): string {
  if (state.status !== 'ready') return UNREAD[state.status];
  const { items, closedRecently, closedWindowDays, generatedAt } = state.report;
  const unclaimed = items.filter((item) => item.pulls.length === 0).length;
  const at = Date.parse(generatedAt);
  const when =
    localDayKey(at) === localDayKey(now)
      ? hoursMinutes(at)
      : `${new Date(at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} ${hoursMinutes(at)}`;
  return `${items.length} open · ${unclaimed} nobody on · ${closedRecently} closed in ${closedWindowDays} days · refreshed ${when}`;
}
