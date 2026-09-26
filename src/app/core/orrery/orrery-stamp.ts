import { ProjectsState } from '../projects/projects-feed';
import { hoursMinutes, localDayKey } from '../usage/usage-format';
import { plural } from '../../shared/text/plural';

const UNREAD: Record<Exclude<ProjectsState['status'], 'ready'>, string> = {
  reading: 'reading the projects',
  unreachable: 'API out of reach',
};

/** "14 worlds · 44 open · refreshed 09:42", with the date for an older read. */
export function orreryStamp(state: ProjectsState, now: number, locale?: string): string {
  if (state.status !== 'ready') return UNREAD[state.status];
  const { projects, generatedAt } = state.report;
  const open = projects.reduce((sum, project) => sum + project.open, 0);
  const at = Date.parse(generatedAt);
  const when =
    localDayKey(at) === localDayKey(now)
      ? hoursMinutes(at)
      : `${new Date(at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} ${hoursMinutes(at)}`;
  return `${plural(projects.length, 'world')} · ${open} open · refreshed ${when}`;
}
