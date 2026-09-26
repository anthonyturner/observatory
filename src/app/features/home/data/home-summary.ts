import { ProjectsState } from '../../../core/projects/projects-feed';
import { severityOf } from '../../../core/projects/severity';
import { hoursMinutes, localDayKey } from '../../../core/usage/usage-format';
import { plural } from '../../../shared/text/plural';

export type StatusState = 'idle' | 'active' | 'error';

/** One reading on the status line; a state gives it a coloured dot. */
export interface StatusItem {
  readonly label: string;
  readonly state?: StatusState;
}

/** What Home's top bar says about the system as a whole. */
export interface HomeSummary {
  readonly stamp: string;
  readonly statuses: readonly StatusItem[];
}

/** Nothing moves the core off idle until the assistant exists. */
const CORE_STATUS: StatusItem = { label: 'Core · Idle', state: 'idle' };
/** Observatory's API reads this machine's files, so it always runs here. */
const WHERE_STATUS: StatusItem = { label: 'Local' };

const UNREAD: Record<Exclude<ProjectsState['status'], 'ready'>, HomeSummary> = {
  reading: {
    stamp: 'reading the projects',
    statuses: [CORE_STATUS, WHERE_STATUS, { label: 'Projects · reading' }],
  },
  unreachable: {
    stamp: 'API out of reach',
    statuses: [CORE_STATUS, WHERE_STATUS, { label: 'Projects · out of reach', state: 'error' }],
  },
};

/** "09:42" for a read today; "25 Sep 09:42" for an older one. */
function refreshedAt(generatedAt: string, now: number, locale?: string): string {
  const at = Date.parse(generatedAt);
  if (localDayKey(at) === localDayKey(now)) return hoursMinutes(at);
  const date = new Date(at).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  return `${date} ${hoursMinutes(at)}`;
}

/** The top bar from the projects: how many are blocked, how many there are,
 *  how many pull requests are open, and when GitHub was last read. */
export function homeSummaryFrom(state: ProjectsState, now: number, locale?: string): HomeSummary {
  if (state.status !== 'ready') return UNREAD[state.status];

  const { projects, generatedAt } = state.report;
  const blocked = projects.filter((project) => severityOf(project).id === 'blocked').length;
  const open = projects.reduce((sum, project) => sum + project.open, 0);
  return {
    stamp: [
      `${blocked} blocked`,
      plural(projects.length, 'project'),
      `${open} open`,
      `refreshed ${refreshedAt(generatedAt, now, locale)}`,
    ].join(' · '),
    statuses: [
      CORE_STATUS,
      WHERE_STATUS,
      { label: `${plural(projects.length, 'project')} tracked` },
    ],
  };
}
