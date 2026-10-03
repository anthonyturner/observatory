import { ActivityItem, ActivityKind } from '../activity/activity.types';

/** A screen reader hears, and a desktop notice lists, this many items, then how many more. */
const ITEMS_TOLD = 3;

const OPENINGS: Readonly<Record<ActivityKind, string>> = {
  merged: 'Pull request merged in',
  issue: 'New issue in',
};

/** A desktop notice's title for one item, and for several. */
const TITLES: Readonly<Record<ActivityKind, { one: string; many: string }>> = {
  merged: { one: 'Pull request merged', many: 'pull requests merged' },
  issue: { one: 'New issue', many: 'new issues' },
};

/** What a desktop notice shows, and the tag that lets the browser show it once. */
export interface DesktopNotice {
  readonly title: string;
  readonly body: string;
  readonly tag: string;
}

const phraseOf = ({ kind, repo, number, title }: ActivityItem): string =>
  `${OPENINGS[kind]} ${repo}, #${number}: ${title}`;

const lineOf = ({ repo, number, title }: ActivityItem): string => `${repo} #${number} · ${title}`;

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
