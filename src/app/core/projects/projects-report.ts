import { ProjectCounts, ProjectSnapshot } from './project.types';

/** A pull request's most urgent state, most urgent first. */
export const PULL_BUCKETS = ['conflicted', 'failing', 'unknown', 'unlinked', 'unreviewed'] as const;

export type PullBucket = (typeof PULL_BUCKETS)[number];

/** One pull request from the top of the blocked-first queue across every project. */
export interface QueueDirective {
  readonly project: string;
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly bucket: PullBucket;
}

/** What `GET /api/projects` returns. */
export interface ProjectsReport {
  readonly generatedAt: string;
  readonly projects: readonly ProjectSnapshot[];
  /** The most urgent open pull requests, most urgent first. */
  readonly directives: readonly QueueDirective[];
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

/** A list with one bad entry is unknown as a whole: a number dropped from it
 *  would read as a pull request that left, or an issue that closed. */
function numbersOf(value: unknown, numberOf: (entry: unknown) => unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const numbers: unknown[] = value.map(numberOf);
  return numbers.every(isCount) ? numbers : null;
}

const pullNumbers = (value: unknown): number[] | null =>
  numbersOf(value, (entry) => (isObject(entry) ? entry['number'] : null));
const issueNumbers = (value: unknown): number[] | null => numbersOf(value, (entry) => entry);

function parseProject(value: unknown): ProjectSnapshot | null {
  if (!isObject(value)) return null;
  const { name, repo, dashboardUrl, open, issues, oldestIdleDays, error } = value;
  const counts = parseCounts(value['counts']);
  if (!isString(name) || !isString(repo) || !isString(dashboardUrl) || !isCount(open) || !counts) {
    return null;
  }
  const openPulls = pullNumbers(value['openPulls']);
  const openIssues = issueNumbers(value['openIssues']);
  return {
    name,
    repo,
    dashboardUrl,
    open,
    counts,
    ...(isCount(issues) ? { issues } : {}),
    ...(isCount(oldestIdleDays) ? { oldestIdleDays } : {}),
    ...(isString(error) ? { error } : {}),
    ...(openPulls ? { openPulls } : {}),
    ...(openIssues ? { openIssues } : {}),
  };
}

const isBucket = (value: unknown): value is PullBucket =>
  (PULL_BUCKETS as readonly unknown[]).includes(value);
/** Only links to GitHub are followed from the page. */
const isGitHubUrl = (value: unknown): value is string =>
  isString(value) && value.startsWith('https://github.com/');

function parseDirective(value: unknown): QueueDirective | null {
  if (!isObject(value)) return null;
  const { project, number, title, url, bucket } = value;
  if (!isString(project) || !isCount(number) || !isString(title) || !isGitHubUrl(url)) return null;
  return isBucket(bucket) ? { project, number, title, url, bucket } : null;
}

/** Reads the report defensively; a project or directive that does not parse
 *  is left out. */
export function parseProjectsReport(value: unknown): ProjectsReport | null {
  if (!isObject(value) || !isString(value['generatedAt']) || !Array.isArray(value['projects'])) {
    return null;
  }
  return {
    generatedAt: value['generatedAt'],
    projects: value['projects']
      .map(parseProject)
      .filter((project): project is ProjectSnapshot => project !== null),
    directives: (Array.isArray(value['directives']) ? value['directives'] : [])
      .map(parseDirective)
      .filter((directive): directive is QueueDirective => directive !== null),
  };
}
