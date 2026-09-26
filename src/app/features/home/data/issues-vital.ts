import { ProjectsState } from '../../../core/projects/projects-feed';
import { ageOf } from '../../../core/usage/usage-format';
import { VitalReading } from './vitals';

const ISSUES_LABEL = { id: 'issues', label: 'Open issues' } as const;

const UNREAD_REASON: Record<Exclude<ProjectsState['status'], 'ready'>, string> = {
  reading: 'reading',
  unreachable: 'API out of reach',
};

/** Open issues across every project. A project GitHub could not read makes
 *  the total a floor, said as "+?", never a quiet undercount. */
export function openIssuesVital(state: ProjectsState, now: number): VitalReading {
  if (state.status !== 'ready') {
    return { ...ISSUES_LABEL, value: null, note: UNREAD_REASON[state.status] };
  }
  const { projects, generatedAt } = state.report;
  const age = ageOf(generatedAt, now);
  const known = projects.filter((project) => !project.error && project.issues !== undefined);
  const unread = projects.filter((project) => project.error).length;
  if (!known.length) return { ...ISSUES_LABEL, value: null, age, note: 'not read' };

  const total = known.reduce((sum, project) => sum + (project.issues ?? 0), 0);
  return {
    ...ISSUES_LABEL,
    value: String(total),
    unit: unread ? '+?' : undefined,
    age,
    note: unread ? `${unread} not read` : `across ${known.length} projects`,
  };
}
