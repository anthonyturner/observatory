import { OpenItem, hrefOf } from '../../../core/assistant/open-items';
import { ProjectSnapshot } from '../../../core/projects/project.types';
import { ProjectsState } from '../../../core/projects/projects-feed';
import { QueueItem } from '../../../core/queue/queue-report';
import { plural } from '../../../shared/text/plural';
import { SkyItem } from '../engine/sky-model';
import { blockedFirst, byBlockedFirst, standingOf } from '../next-star';
import { NamedProject } from './queue-command';

/** One project's open pull requests, as its review queue reads them. */
export interface ProjectQueue {
  readonly project: NamedProject;
  readonly items: readonly QueueItem[];
}

/** A pull request from the top of the queues, and the project it is in. */
export interface TopPull {
  readonly project: NamedProject;
  readonly item: SkyItem;
}

/** The projects GitHub could read, or null until they are read. */
export const readProjectsOf = (state: ProjectsState): readonly ProjectSnapshot[] | null =>
  state.status === 'ready' ? state.report.projects.filter((each) => !each.error) : null;

/** How many pull requests "what's blocking?" reads out. */
export const BLOCKING_COUNT = 3;

/**
 * The first `count` workable pull requests across `queues`, in Next star's
 * blocked-first order, so the first of them is Next star's pick wherever no
 * merge plan has been read.
 */
export function topOfQueues(queues: readonly ProjectQueue[], count: number): TopPull[] {
  return queues
    .flatMap(({ project, items }) => blockedFirst(items).map((item) => ({ project, item })))
    .sort((a, b) => byBlockedFirst(a.item, b.item))
    .slice(0, count);
}

/** How Jev names one: "observatory pull request 412, “Fix login”". */
export const pullNameOf = (project: NamedProject, pr: number, title: string | null): string =>
  `${project.name} pull request ${pr}${title ? `, “${title}”` : ''}`;

export const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/** Pull request `number` as Jev's open question lists it, to open or send a crew to;
 *  an unknown title is empty. */
export const pullItemOf = (
  project: NamedProject,
  number: number,
  title: string | null,
): OpenItem => ({
  kind: 'pull',
  repo: project.repo,
  label: project.name,
  number,
  title: title ?? '',
  href: hrefOf('pull', project.repo, number),
});

/** What Jev asks after the blocking list. */
export const offerOf = (items: readonly OpenItem[]): string =>
  `Want to work on ${items.length === 1 ? 'it' : 'one'}? I can open it or send a crew.`;

const lineOf = ({ project, item }: TopPull): string =>
  `${pullNameOf(project, item.pr, item.title)}: ${lowerFirst(standingOf(item))}`;

/** What Jev says to "what's blocking?": each of `top` with where it stands. */
export function blockingWords(top: readonly TopPull[], project: NamedProject | null): string {
  if (!top.length) {
    return `Nothing is waiting${project ? ` in ${project.name}` : ''}: drafts, snoozed and dismissed ones aside.`;
  }
  const lead =
    top.length < BLOCKING_COUNT
      ? `Only ${plural(top.length, 'pull request')} to work, blocked first`
      : `The top ${top.length}, blocked first`;
  return `${lead}. ${top.map((pull, index) => `${index + 1}: ${lineOf(pull)}.`).join(' ')}`;
}

/** What Jev says as Next star opens `pull`. */
export const nextStarWords = ({ project, item }: TopPull): string =>
  `Next star: ${pullNameOf(project, item.pr, item.title)}, ${lowerFirst(standingOf(item))}. Opening it`;
