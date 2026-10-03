import { ActivityItem, ActivityKind, ClosedIssue } from '../activity/activity.types';

/** A screen reader hears, and a desktop notice lists, this many items, then how many more. */
const ITEMS_TOLD = 3;
/** Jev says this many items of a line, then how many more. */
const SAID_ITEMS = 3;

const OPENINGS: Readonly<Record<ActivityKind, string>> = {
  merged: 'Pull request merged in',
  'issue-closed': 'Issue closed in',
  'pull-opened': 'Pull request opened in',
  issue: 'New issue in',
};

/** A desktop notice's title for one item, and for several. */
const TITLES: Readonly<Record<ActivityKind, { one: string; many: string }>> = {
  merged: { one: 'Pull request merged', many: 'pull requests merged' },
  'issue-closed': { one: 'Issue closed', many: 'issues closed' },
  'pull-opened': { one: 'Pull request opened', many: 'pull requests opened' },
  issue: { one: 'New issue', many: 'new issues' },
};

/** What a desktop notice shows, and the tag that lets the browser show it once. */
export interface DesktopNotice {
  readonly title: string;
  readonly body: string;
  readonly tag: string;
}

/** ", closing …" with each issue a merge closed; empty for any other item. */
function closingOf(item: ActivityItem, name: (issue: ClosedIssue) => string): string {
  const closing = item.closing ?? [];
  return closing.length ? `, closing ${closing.map(name).join(' and ')}` : '';
}

const saidIssue = ({ number, title }: ClosedIssue): string => `issue ${number}, ${title}`;
const readIssue = ({ number, title }: ClosedIssue): string => `#${number}: ${title}`;
const listedIssue = ({ number, title }: ClosedIssue): string => `#${number} · ${title}`;

/** Jev's words name the project as it is shown, and the number without its
 *  "#", which a voice would read out. */
const SAYINGS: Readonly<Record<ActivityKind, (item: ActivityItem) => string>> = {
  merged: (item) =>
    `Pull request ${item.number} in ${item.label} merged: ${item.title}${closingOf(item, saidIssue)}`,
  'issue-closed': ({ number, label, title }) => `Issue ${number} in ${label} closed: ${title}`,
  'pull-opened': ({ number, label, title }) =>
    `Pull request ${number} in ${label} opened: ${title}`,
  issue: ({ number, label, title }) => `New issue ${number} in ${label}: ${title}`,
};

const ENDS_A_SENTENCE = /[.!?]$/;

const phraseOf = (item: ActivityItem): string =>
  `${OPENINGS[item.kind]} ${item.repo}, #${item.number}: ${item.title}${closingOf(item, readIssue)}`;

const lineOf = (item: ActivityItem): string =>
  `${item.repo} #${item.number} · ${item.title}${closingOf(item, listedIssue)}`;

/** The words as one sentence, with a full stop unless they already end one. */
export const sentenceOf = (words: string): string => {
  const trimmed = words.trim();
  return ENDS_A_SENTENCE.test(trimmed) ? trimmed : `${trimmed}.`;
};

/** The first few items, and how many were left out. */
function firstFew(items: readonly ActivityItem[]): { told: ActivityItem[]; more: number } {
  const told = items.slice(0, ITEMS_TOLD);
  return { told, more: items.length - told.length };
}

/** One check's news as a single sentence, for the polite live region. */
export function announcementOf(items: readonly ActivityItem[]): string {
  const { told, more } = firstFew(items);
  return `${told.map(phraseOf).join('; ')}${more > 0 ? `; and ${more} more` : ''}.`;
}

/**
 * One check's news of one kind as a desktop notice: a line per item, then how
 * many more. The tag names every event in it, so a second tab showing the same
 * news replaces the first's notice rather than adding another.
 */
export function desktopNoticeOf(kind: ActivityKind, items: readonly ActivityItem[]): DesktopNotice {
  const { told, more } = firstFew(items);
  const { one, many } = TITLES[kind];
  const lines = told.map(lineOf);
  if (more > 0) lines.push(`and ${more} more`);
  const events = items.map(({ repo, number }) => `${repo}#${number}`).join(',');
  return {
    title: items.length === 1 ? one : `${items.length} ${many}`,
    body: lines.join('\n'),
    tag: `observatory-${kind}-${events}`,
  };
}

/** The news as Jev says it: one sentence an item, then how many more. */
export function sayingOf(items: readonly ActivityItem[]): string {
  const said = items.slice(0, SAID_ITEMS).map((item) => sentenceOf(SAYINGS[item.kind](item)));
  const more = items.length - said.length;
  return [...said, ...(more > 0 ? [`And ${more} more.`] : [])].join(' ');
}
