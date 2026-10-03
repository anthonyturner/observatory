import { ActivityItem, ActivityKind } from '../../core/activity/activity.types';
import { ActivityNotice, Notice, NoticeKind } from '../../core/notices/notice.types';
import { mailNoticeView, signInNoticeView } from './mail-notice-view';

/** A page in Observatory, and the section on it to land on, if any. */
export interface NoticeRoute {
  readonly kind: 'route';
  readonly path: readonly string[];
  readonly query: Readonly<Record<string, number>>;
  readonly fragment?: string;
}

/** Where a row's title goes: GitHub in a new tab, or a page in Observatory. */
export type NoticeLink = { readonly kind: 'external'; readonly href: string } | NoticeRoute;

/** An issue a merged pull request closed, named under it. */
export interface NoticeClosingView {
  readonly key: string;
  readonly number: number;
  readonly title: string;
  readonly link: NoticeRoute;
}

export interface NoticeRowView {
  readonly key: string;
  /** Who or where: a project, or a sender. */
  readonly label: string;
  /** Beside the label: "#12", a mail account, or nothing. */
  readonly badge: string | null;
  readonly title: string;
  readonly link: NoticeLink;
  readonly closing: readonly NoticeClosingView[];
}

/** A notice ready to render. */
export interface NoticeView {
  readonly id: number;
  readonly kind: NoticeKind;
  readonly tag: string;
  /** "3 pull requests merged" for a group; null for one item, which the head names. */
  readonly heading: string | null;
  readonly rows: readonly NoticeRowView[];
  readonly dismissLabel: string;
}

const TAGS: Readonly<Record<ActivityKind, string>> = {
  merged: 'Merged',
  'issue-closed': 'Issue closed',
  'pull-opened': 'PR opened',
  issue: 'New issue',
};

const GROUP_HEADINGS: Readonly<Record<ActivityKind, (count: number) => string>> = {
  merged: (count) => `${count} pull requests merged`,
  'issue-closed': (count) => `${count} issues closed`,
  'pull-opened': (count) => `${count} pull requests opened`,
  issue: (count) => `${count} new issues`,
};

const ONE_HEADINGS: Readonly<Record<ActivityKind, string>> = {
  merged: 'pull request merged',
  'issue-closed': 'issue closed',
  'pull-opened': 'pull request opened',
  issue: 'new issue',
};

const GITHUB = 'https://github.com';

type LinkOf = (owner: string, name: string, number: number) => NoticeLink;

const pullOnGitHub: LinkOf = (owner, name, number) => ({
  kind: 'external',
  href: `${GITHUB}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pull/${number}`,
});

const issueOnStarMap = (owner: string, name: string, number: number): NoticeRoute => ({
  kind: 'route',
  path: ['/p', owner, name],
  query: { issue: number },
});

/** Where each kind's title goes, given the repository's owner and name. */
const LINKS: Readonly<Record<ActivityKind, LinkOf>> = {
  merged: pullOnGitHub,
  'issue-closed': issueOnStarMap,
  'pull-opened': pullOnGitHub,
  issue: issueOnStarMap,
};

const ownerAndName = (repo: string): [string, string] => {
  const [owner = '', name = ''] = repo.split('/');
  return [owner, name];
};

function rowOf(item: ActivityItem): NoticeRowView {
  const [owner, name] = ownerAndName(item.repo);
  return {
    key: `${item.repo}#${item.number}`,
    label: item.label,
    badge: `#${item.number}`,
    title: item.title,
    link: LINKS[item.kind](owner, name, item.number),
    closing: (item.closing ?? []).map(({ number, title }) => ({
      key: `${item.repo}#${number}`,
      number,
      title,
      link: issueOnStarMap(owner, name, number),
    })),
  };
}

function activityNoticeView({ id, kind, items }: ActivityNotice): NoticeView {
  const isGroup = items.length > 1;
  const first = items[0];
  const subject = isGroup
    ? GROUP_HEADINGS[kind](items.length)
    : `${ONE_HEADINGS[kind]}, ${first.label} #${first.number}`;
  return {
    id,
    kind,
    tag: TAGS[kind],
    heading: isGroup ? GROUP_HEADINGS[kind](items.length) : null,
    rows: items.map(rowOf),
    dismissLabel: `Dismiss: ${subject}`,
  };
}

export function noticeView(notice: Notice): NoticeView {
  switch (notice.kind) {
    case 'mail':
      return mailNoticeView(notice);
    case 'mail-sign-in':
      return signInNoticeView(notice);
    default:
      return activityNoticeView(notice);
  }
}
