import { ProjectCounts, ProjectSnapshot } from './project.types';

/** What `GET /api/projects` returns. */
export interface ProjectsReport {
  readonly generatedAt: string;
  readonly projects: readonly ProjectSnapshot[];
}

type Json = Record<string, unknown>;

const COUNT_FIELDS: readonly (keyof ProjectCounts)[] = [
  'conflicted',
  'failing',
  'unknown',
  'unlinked',
  'unreviewed',
  'unclaimed',
];

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isString = (value: unknown): value is string => typeof value === 'string';

function parseCounts(value: unknown): ProjectCounts | null {
  if (!isObject(value) || !COUNT_FIELDS.every((field) => isCount(value[field]))) return null;
  return Object.fromEntries(
    COUNT_FIELDS.map((field) => [field, value[field]]),
  ) as unknown as ProjectCounts;
}

function parseProject(value: unknown): ProjectSnapshot | null {
  if (!isObject(value)) return null;
  const { name, repo, dashboardUrl, open, issues, oldestIdleDays, error } = value;
  const counts = parseCounts(value['counts']);
  if (!isString(name) || !isString(repo) || !isString(dashboardUrl) || !isCount(open) || !counts) {
    return null;
  }
  return {
    name,
    repo,
    dashboardUrl,
    open,
    counts,
    ...(isCount(issues) ? { issues } : {}),
    ...(isCount(oldestIdleDays) ? { oldestIdleDays } : {}),
    ...(isString(error) ? { error } : {}),
  };
}

/** Reads the report defensively; a project that does not parse is left out. */
export function parseProjectsReport(value: unknown): ProjectsReport | null {
  if (!isObject(value) || !isString(value['generatedAt']) || !Array.isArray(value['projects'])) {
    return null;
  }
  return {
    generatedAt: value['generatedAt'],
    projects: value['projects']
      .map(parseProject)
      .filter((project): project is ProjectSnapshot => project !== null),
  };
}
