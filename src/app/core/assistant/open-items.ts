import { ActivityItem, ActivityKind } from '../activity/activity.types';

export type OpenKind = 'pull' | 'issue';

/** A pull request or issue Jev just announced that is still open. */
export interface OpenItem {
  readonly kind: OpenKind;
  readonly repo: string;
  readonly label: string;
  readonly number: number;
  readonly title: string;
  /** The PR screen or the issue's window on its project's star map. */
  readonly href: string;
}

/** Which kinds of news leave something open to look at. */
const OPEN_KINDS: Readonly<Record<ActivityKind, OpenKind | null>> = {
  merged: null,
  'issue-closed': null,
  'pull-opened': 'pull',
  issue: 'issue',
};

/** The star map opens a pull request's screen with `?pr=`, an issue's window with `?issue=`. */
const QUERY_KEYS: Readonly<Record<OpenKind, string>> = { pull: 'pr', issue: 'issue' };

const NOUNS: Readonly<Record<OpenKind, { readonly one: string; readonly many: string }>> = {
  pull: { one: 'the pull request', many: 'pull requests' },
  issue: { one: 'the issue', many: 'issues' },
};
const KIND_ORDER: readonly OpenKind[] = ['pull', 'issue'];

export const KIND_NAMES: Readonly<Record<OpenKind, string>> = {
  pull: 'Pull request',
  issue: 'Issue',
};

/** How a line names the item: "pull request 12 in alpha". */
export const itemNameOf = ({ kind, number, label }: OpenItem): string =>
  `${KIND_NAMES[kind].toLowerCase()} ${number} in ${label}`;

const keyOf = (kind: OpenKind, repo: string, number: number): string =>
  `${kind}:${repo}#${number}`;

/** Every pull request and issue the batch shows has since merged or closed. */
function doneKeysOf(items: readonly ActivityItem[]): ReadonlySet<string> {
  const done = new Set<string>();
  for (const { kind, repo, number, closing } of items) {
    if (kind === 'merged') done.add(keyOf('pull', repo, number));
    if (kind === 'issue-closed') done.add(keyOf('issue', repo, number));
    for (const closed of closing ?? []) done.add(keyOf('issue', repo, closed.number));
  }
  return done;
}

function hrefOf(kind: OpenKind, repo: string, number: number): string {
  const [owner = '', name = ''] = repo.split('/');
  const path = `/p/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  return `${path}?${QUERY_KEYS[kind]}=${number}`;
}

/** The batch's opened pull requests and new issues, less any it also shows merged or closed. */
export function openItemsOf(items: readonly ActivityItem[]): OpenItem[] {
  const done = doneKeysOf(items);
  return items.flatMap(({ kind, repo, label, number, title }) => {
    const openKind = OPEN_KINDS[kind];
    if (!openKind || done.has(keyOf(openKind, repo, number))) return [];
    return [{ kind: openKind, repo, label, number, title, href: hrefOf(openKind, repo, number) }];
  });
}

/** Jev's question, said last. After mail, "them" could mean the emails, so it names the kinds. */
export function questionOf(items: readonly OpenItem[], hasMail: boolean): string {
  const isOne = items.length === 1;
  if (!hasMail) return isOne ? 'Would you like to open it?' : 'Would you like to open any of them?';
  if (isOne) return `Would you like to open ${NOUNS[items[0].kind].one}?`;
  const kinds = KIND_ORDER.filter((kind) => items.some((item) => item.kind === kind));
  return `Would you like to open any of the ${kinds.map((kind) => NOUNS[kind].many).join(' or ')}?`;
}
