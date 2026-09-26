/** One open issue as the Issues tab lists it. */
export interface IssueItem {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
  /** Open pull requests that say they close it; none means nobody is on it. */
  readonly pulls: readonly number[];
  readonly idleDays: number;
  readonly ageDays: number;
}

/** What `GET /api/issues` returns. */
export interface IssuesReport {
  readonly generatedAt: string;
  readonly repo: string;
  readonly items: readonly IssueItem[];
  readonly closedRecently: number;
  readonly closedWindowDays: number;
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isString = (value: unknown): value is string => typeof value === 'string';
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter(isString) : []);
const counts = (value: unknown): number[] => (Array.isArray(value) ? value.filter(isCount) : []);
/** Only links to GitHub are followed from the page. */
const isGitHub = (value: unknown): value is string =>
  isString(value) && value.startsWith('https://github.com/');

function parseItem(value: unknown): IssueItem | null {
  if (!isObject(value)) return null;
  const { number, title, url, idleDays, ageDays } = value;
  if (!isCount(number) || !isString(title) || !isGitHub(url)) return null;
  return {
    number,
    title,
    url,
    labels: strings(value['labels']),
    assignees: strings(value['assignees']),
    pulls: counts(value['pulls']),
    idleDays: isCount(idleDays) ? idleDays : 0,
    ageDays: isCount(ageDays) ? ageDays : 0,
  };
}

/** Reads the report defensively; an issue that does not parse is left out. */
export function parseIssuesReport(value: unknown): IssuesReport | null {
  if (!isObject(value) || !isString(value['generatedAt']) || !isString(value['repo'])) return null;
  if (!Array.isArray(value['items'])) return null;
  return {
    generatedAt: value['generatedAt'],
    repo: value['repo'],
    items: value['items'].map(parseItem).filter((item): item is IssueItem => item !== null),
    closedRecently: isCount(value['closedRecently']) ? value['closedRecently'] : 0,
    closedWindowDays: isCount(value['closedWindowDays']) ? value['closedWindowDays'] : 30,
  };
}
