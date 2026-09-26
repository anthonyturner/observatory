import { ProjectSnapshot } from './project.types';

export type SeverityId = 'blocked' | 'unsettled' | 'unreadable' | 'untracked' | 'waiting' | 'clear';

/** A project's colour: its worst problem, not its average. */
export interface Severity {
  readonly id: SeverityId;
  readonly kind: string;
  readonly word: string;
  readonly means: string;
  readonly color: string;
}

/** In card order. Unreadable sits above every project GitHub could read:
 *  unknown is never healthy. */
export const SEVERITIES: readonly Severity[] = [
  {
    id: 'blocked',
    kind: 'Blocked',
    word: 'blocked',
    means: 'a pull request cannot merge or its checks fail',
    color: 'var(--sev-blocked)',
  },
  {
    id: 'unsettled',
    kind: 'Unsettled',
    word: 'unsettled',
    means: 'GitHub has not yet worked out whether one merges',
    color: 'var(--sev-unsettled)',
  },
  {
    id: 'unreadable',
    kind: 'Unreadable',
    word: 'unreadable',
    means: 'GitHub could not be read for it',
    color: 'var(--sev-unreadable)',
  },
  {
    id: 'untracked',
    kind: 'Untracked work',
    word: 'untracked',
    means: 'a pull request has no issue linked',
    color: 'var(--sev-untracked)',
  },
  {
    id: 'waiting',
    kind: 'Waiting',
    word: 'waiting',
    means: 'pull requests waiting on you',
    color: 'var(--sev-waiting)',
  },
  {
    id: 'clear',
    kind: 'Clear',
    word: 'clear',
    means: 'nothing waiting',
    color: 'var(--sev-clear)',
  },
];

const byId = new Map(SEVERITIES.map((severity) => [severity.id, severity]));
const rankOf = new Map(SEVERITIES.map((severity, index) => [severity.id, index]));

export function severityOf(project: ProjectSnapshot): Severity {
  return byId.get(severityIdOf(project)) as Severity;
}

function severityIdOf({ error, counts }: ProjectSnapshot): SeverityId {
  if (error) return 'unreadable';
  if (counts.conflicted + counts.failing > 0) return 'blocked';
  if (counts.unknown > 0) return 'unsettled';
  if (counts.unlinked > 0) return 'untracked';
  if (counts.unreviewed > 0) return 'waiting';
  return 'clear';
}

const stuckCount = ({ counts }: ProjectSnapshot): number => counts.conflicted + counts.failing;
const severityRank = (project: ProjectSnapshot): number =>
  rankOf.get(severityOf(project).id) as number;

/** Worst severity first; within one, most stuck, then most open, then by name. */
export function compareProjects(a: ProjectSnapshot, b: ProjectSnapshot): number {
  return (
    severityRank(a) - severityRank(b) ||
    stuckCount(b) - stuckCount(a) ||
    b.open - a.open ||
    a.name.localeCompare(b.name)
  );
}

/** "1 blocked · 2 waiting": how many projects sit in each severity, worst first. */
export function severitySummary(projects: readonly ProjectSnapshot[]): string {
  return SEVERITIES.map((severity) => ({
    severity,
    total: projects.filter((project) => severityOf(project) === severity).length,
  }))
    .filter(({ total }) => total > 0)
    .map(({ severity, total }) => `${total} ${severity.word}`)
    .join(' · ');
}
