import { OpenKind, hrefOf } from '../../core/assistant/open-items';
import { InboxItem } from '../../core/inbox/inbox-report';
import { plural } from '../../shared/text/plural';
import { agoWords } from '../actions/actions-words';
import { ReasonTone, reasonRank, reasonWords, subjectWords } from './inbox-words';

export interface InboxRowView {
  readonly id: string;
  readonly title: string;
  /** "Pull request #7 · 3h ago". */
  readonly meta: string;
  readonly href: string;
  /** Opens in Observatory, on its project's Review Queue, rather than on GitHub in a new tab. */
  readonly isInside: boolean;
  /** The Mark read button's accessible name, naming the row. */
  readonly markLabel: string;
}

export interface ReasonGroupView {
  readonly key: string;
  readonly label: string;
  readonly tone: ReasonTone;
  /** "Review requested in me/app", for the list under the heading. */
  readonly listLabel: string;
  readonly rows: readonly InboxRowView[];
}

export interface RepoGroupView {
  readonly repo: string;
  /** Unique on the page, for the section's heading. */
  readonly headingId: string;
  /** "3 unread". */
  readonly count: string;
  /** One of the projects Observatory charts. */
  readonly isTracked: boolean;
  readonly reasons: readonly ReasonGroupView[];
}

/** The subjects that open inside Observatory when their project is charted. */
const OPEN_KINDS: ReadonlyMap<string, OpenKind> = new Map([
  ['PullRequest', 'pull'],
  ['Issue', 'issue'],
]);

/** Its PR screen or issue window on a charted project's Review Queue, else its page on GitHub. */
function linkOf(item: InboxItem, isTracked: boolean): Pick<InboxRowView, 'href' | 'isInside'> {
  const kind = OPEN_KINDS.get(item.subjectType);
  return isTracked && kind && item.number !== null
    ? { href: hrefOf(kind, item.repo, item.number), isInside: true }
    : { href: item.url, isInside: false };
}

function rowOf(item: InboxItem, isTracked: boolean, now: number): InboxRowView {
  const subject = subjectWords(item.subjectType);
  const named = item.number === null ? subject : `${subject} #${item.number}`;
  return {
    id: item.id,
    title: item.title,
    meta: `${named} · ${agoWords(item.updatedAt, now)}`,
    ...linkOf(item, isTracked),
    markLabel: `Mark read: ${item.title}`,
  };
}

/** `items` keyed by `keyOf`, each group in the order its first item came. */
function groupBy(items: readonly InboxItem[], keyOf: (item: InboxItem) => string) {
  const groups = new Map<string, InboxItem[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups];
}

function reasonGroups(
  repo: string,
  items: readonly InboxItem[],
  rowFor: (item: InboxItem) => InboxRowView,
): ReasonGroupView[] {
  return groupBy(items, (item) => item.reason)
    .sort(([a], [b]) => reasonRank(a) - reasonRank(b))
    .map(([reason, reasonItems]) => {
      const { label, tone } = reasonWords(reason);
      return {
        key: reason,
        label,
        tone,
        listLabel: `${label} in ${repo}`,
        rows: reasonItems.map(rowFor),
      };
    });
}

/**
 * The unread notifications by repository, the most recently active first, and
 * within each by reason, what waits on you first. A pull request or issue in a
 * project Observatory charts opens on its Review Queue; anything else on GitHub.
 * `tracked` holds the charted projects as lower-case `owner/name`.
 */
export function inboxGroups(
  items: readonly InboxItem[],
  tracked: ReadonlySet<string>,
  now: number,
): RepoGroupView[] {
  return groupBy(items, (item) => item.repo).map(([repo, repoItems], index) => {
    const isTracked = tracked.has(repo.toLowerCase());
    return {
      repo,
      headingId: `inbox-repo-${index}`,
      count: `${repoItems.length} unread`,
      isTracked,
      reasons: reasonGroups(repo, repoItems, (item) => rowOf(item, isTracked, now)),
    };
  });
}

/** "Inbox, 3 unread" for the way to the Inbox, or just its name with none or none known. */
export const inboxLinkName = (count: number | null): string =>
  count ? `Inbox, ${plural(count, 'unread notification')}` : 'Inbox';
