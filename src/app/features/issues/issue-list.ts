import { Issue, IssueLabel, IssuesReport } from '../../core/issues/issues-report';
import { formatDay } from '../../core/logs/log-format';
import { QueueItem, shownBucket } from '../../core/queue/queue-report';
import { BY_ID } from '../starmap/engine/sky-model';
import { fmtN } from '../starmap/starmap-view';

export type IssueTab = 'open' | 'closed';

/** The legend's one filter on the Issues screen: open issues nobody is on. */
export const COMET_FILTER = 'comet';

const DAY_MS = 86_400_000;
const NOT_PLANNED = 'NOT_PLANNED';
/** GitHub label colours are six hex digits; anything else is not painted. */
const LABEL_HEX = /^[0-9a-f]{6}$/i;
const NUMBER_QUERY = /^#?(\d+)$/;

export interface IssueTabInfo {
  readonly id: IssueTab;
  readonly label: string;
  readonly heading: string;
  readonly colour: string;
  /** What the list says when the tab has nothing. */
  readonly none: string;
}

export const ISSUE_TABS: readonly IssueTabInfo[] = [
  {
    id: 'open',
    label: 'Open',
    heading: 'Open issues',
    colour: 'var(--flow)',
    none: 'No open issues.',
  },
  {
    id: 'closed',
    label: 'Closed',
    heading: 'Closed in the last 60 days',
    colour: 'var(--ok)',
    none: 'Nothing closed in the last 60 days.',
  },
];

export const tabInfo = (tab: IssueTab): IssueTabInfo =>
  ISSUE_TABS.find((each) => each.id === tab) ?? ISSUE_TABS[0];

/** What narrows the list: a label, the search box, and the legend's comets. */
export interface IssueNarrowing {
  readonly label: string;
  readonly query: string;
  readonly cometsOnly: boolean;
}

export function issueMatches(issue: Issue, narrowing: IssueNarrowing): boolean {
  if (narrowing.label && !issue.labels.some((l) => l.name === narrowing.label)) return false;
  if (narrowing.cometsOnly && !issue.comet) return false;
  const query = narrowing.query.trim().toLowerCase();
  if (!query) return true;
  const number = NUMBER_QUERY.exec(query);
  return (
    (!!number && issue.number === Number(number[1])) || issue.title.toLowerCase().includes(query)
  );
}

/** One entry of the label menu. */
export interface LabelOption {
  readonly name: string;
  readonly count: number;
}

/** Only labels this list carries, each with how many it would show, by name;
 *  a chosen label stays in the menu even when the list no longer has it. */
export function labelOptions(list: readonly Issue[], chosen: string): LabelOption[] {
  const counts = new Map<string, number>();
  for (const issue of list) {
    for (const label of issue.labels) counts.set(label.name, (counts.get(label.name) ?? 0) + 1);
  }
  if (chosen && !counts.has(chosen)) counts.set(chosen, 0);
  return [...counts]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

/** A label's colour as CSS, or the faint ink when GitHub's is not a colour. */
export const labelInk = (color: string): string =>
  LABEL_HEX.test(color) ? `#${color}` : 'var(--faint)';

/** An issue's labels as the chips paint them. */
export const labelChips = (labels: readonly IssueLabel[]): { name: string; ink: string }[] =>
  labels.map((label) => ({ name: label.name, ink: labelInk(label.color) }));

/** A plain left click stays on the page; any other opens a link as usual. */
export const isPlainClick = (event: MouseEvent): boolean =>
  event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;

export const daysSince = (iso: string, now: number): number =>
  Math.max(0, Math.floor((now - Date.parse(iso)) / DAY_MS));

/** An open pull request the queue knows: a chip for it opens its screen. */
export interface OpenPull {
  readonly title: string;
  readonly colour: string;
}

export function openPullsOf(items: readonly QueueItem[]): ReadonlyMap<number, OpenPull> {
  return new Map(
    items.map((item) => [
      item.number,
      { title: item.title, colour: BY_ID.get(shownBucket(item))?.colour ?? 'var(--flow)' },
    ]),
  );
}

/** A chip per linked pull request: an open one opens its screen here, any
 *  other opens on GitHub. */
export interface PullChip {
  readonly number: number;
  readonly title: string;
  /** Set for an open pull request, which opens its screen. */
  readonly colour: string | null;
  /** Set for a merged or closed one, which opens on GitHub. */
  readonly href: string | null;
}

export function pullChips(
  prs: readonly number[],
  issueUrl: string,
  pulls: ReadonlyMap<number, OpenPull>,
): PullChip[] {
  const base = issueUrl.replace(/\/issues\/\d+$/, '');
  return prs.map((number) => {
    const open = pulls.get(number);
    return open
      ? {
          number,
          title: `Open pull request #${number}: ${open.title}`,
          colour: open.colour,
          href: null,
        }
      : {
          number,
          title: `Pull request #${number} is merged or closed; opens on GitHub`,
          colour: null,
          href: `${base}/pull/${number}`,
        };
  });
}

/** One row of the list, ready to render. */
export interface IssueRowView {
  readonly issue: Issue;
  /** The row's edge. */
  readonly sev: string;
  /** "open 12d", or "closed Sep 20 · not planned". */
  readonly when: string;
  readonly labels: readonly { readonly name: string; readonly ink: string }[];
  readonly chips: readonly PullChip[];
  /** Whether the row has a line of marks under its title. */
  readonly hasMeta: boolean;
}

function rowSev(issue: Issue): string {
  if (issue.comet) return 'var(--count-unclaimed)';
  if (!issue.closedAt) return 'var(--flow)';
  return issue.stateReason === NOT_PLANNED ? 'var(--faint)' : 'var(--ok)';
}

function rowWhen(issue: Issue, now: number): string {
  if (!issue.closedAt) return `open ${daysSince(issue.createdAt, now)}d`;
  return `closed ${formatDay(issue.closedAt)}${issue.stateReason === NOT_PLANNED ? ' · not planned' : ''}`;
}

export function issueRowView(
  issue: Issue,
  pulls: ReadonlyMap<number, OpenPull>,
  now: number,
): IssueRowView {
  return {
    issue,
    sev: rowSev(issue),
    when: rowWhen(issue, now),
    labels: labelChips(issue.labels),
    chips: pullChips(issue.prs, issue.url, pulls),
    hasMeta: issue.comet || !!(issue.labels.length || issue.assignees.length || issue.prs.length),
  };
}

/** The list under the bar: one section for the tab, or a word in its place. */
export interface IssueSectionView {
  readonly heading: string;
  readonly colour: string;
  /** "12 of 91 · 3 with nobody on them". */
  readonly counts: string;
  /** Set when there are no rows to show. */
  readonly none: string | null;
  readonly rows: readonly IssueRowView[];
}

export interface SectionInput {
  readonly tab: IssueTab;
  readonly report: IssuesReport;
  readonly narrowing: IssueNarrowing;
  readonly pulls: ReadonlyMap<number, OpenPull>;
  readonly now: number;
}

export function issueSection(input: SectionInput): IssueSectionView {
  const { tab, report, narrowing, pulls, now } = input;
  const info = tabInfo(tab);
  const all = report[tab];
  const shown = all.filter((issue) => issueMatches(issue, narrowing));
  const comets = shown.filter((issue) => issue.comet).length;
  const of =
    shown.length === all.length ? fmtN(all.length) : `${fmtN(shown.length)} of ${fmtN(all.length)}`;
  const nobody =
    tab === 'open' && comets ? ` · ${comets} with nobody on ${comets === 1 ? 'it' : 'them'}` : '';
  return {
    heading: info.heading,
    colour: info.colour,
    counts: `${of}${nobody}`,
    none: shown.length ? null : all.length ? 'Nothing matches.' : info.none,
    rows: shown.map((issue) => issueRowView(issue, pulls, now)),
  };
}
