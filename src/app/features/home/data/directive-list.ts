import { ProjectsState } from '../../../core/projects/projects-feed';
import { PullBucket } from '../../../core/projects/projects-report';
import { plural } from '../../../shared/text/plural';
import { DirectiveList } from './vitals';

/** How each state reads on the list, and its box's colour. */
const BUCKET_LOOK: Record<PullBucket, { readonly label: string; readonly color: string }> = {
  conflicted: { label: 'cannot merge', color: 'var(--count-conflicted)' },
  failing: { label: 'checks failing', color: 'var(--count-failing)' },
  unknown: { label: 'mergeability unknown', color: 'var(--count-unknown)' },
  unlinked: { label: 'no issue linked', color: 'var(--count-unlinked)' },
  unreviewed: { label: 'waiting on you', color: 'var(--count-unreviewed)' },
};

const UNREAD_NOTE: Record<Exclude<ProjectsState['status'], 'ready'>, string> = {
  reading: 'Reading the queues',
  unreachable: 'API out of reach · unknown',
};

/** The top of the blocked-first queue as Home lists it. A project GitHub
 *  could not read is said, since its pull requests might outrank these. */
export function directiveListFrom(state: ProjectsState): DirectiveList {
  if (state.status !== 'ready') return { items: [], note: UNREAD_NOTE[state.status] };

  const { projects, directives } = state.report;
  const unreadable = projects.filter((project) => project.error).length;
  const gap = unreadable ? `${plural(unreadable, 'project')} unreadable` : null;
  const items = directives.map((directive) => ({
    title: directive.title,
    href: directive.url,
    detail: `${directive.project} #${directive.number} · ${BUCKET_LOOK[directive.bucket].label}`,
    color: BUCKET_LOOK[directive.bucket].color,
  }));
  if (!items.length) return { items, note: gap ? `${gap} · unknown` : 'Nothing open' };
  return { items, note: gap ?? 'Blocked first · on GitHub' };
}
