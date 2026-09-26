export interface IssueLabel {
  readonly name: string;
  /** GitHub's six hex digits, without the `#`; anything else is not painted. */
  readonly color: string;
}

/** One issue as pr-starmap's `issues/current` lists it. */
export interface Issue {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly labels: readonly IssueLabel[];
  readonly assignees: readonly string[];
  readonly author: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Null while it is open. */
  readonly closedAt: string | null;
  /** How a closed issue closed: `COMPLETED`, `NOT_PLANNED`, `DUPLICATE`, or null. */
  readonly stateReason: string | null;
  /** An open issue no open pull request closes. */
  readonly comet: boolean;
  /** This repository's pull requests linked to it, open or not. */
  readonly prs: readonly number[];
}

export interface IssueTotals {
  readonly open: number;
  readonly closed: number;
  readonly comets: number;
}

/** What `GET /api/issues` returns. */
export interface IssuesReport {
  readonly generatedAt: string;
  readonly repo: string;
  /** How far back `closed` reaches. */
  readonly days: number;
  readonly total: IssueTotals;
  readonly open: readonly Issue[];
  readonly closed: readonly Issue[];
}

type Json = Record<string, unknown>;

const DEFAULT_DAYS = 60;

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
const isDate = (value: unknown): value is string =>
  isString(value) && !Number.isNaN(Date.parse(value));

function labelsOf(value: unknown): IssueLabel[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .flatMap((label) =>
      isString(label['name'])
        ? [{ name: label['name'], color: isString(label['color']) ? label['color'] : '' }]
        : [],
    );
}

/** One issue as the API lists it, or null when it does not parse. */
export function parseIssue(value: unknown): Issue | null {
  if (!isObject(value)) return null;
  const { number, title, url, createdAt, updatedAt, closedAt, stateReason, author } = value;
  if (!isCount(number) || !isString(title) || !isGitHub(url)) return null;
  if (!isDate(createdAt) || !isDate(updatedAt)) return null;
  return {
    number,
    title,
    url,
    labels: labelsOf(value['labels']),
    assignees: strings(value['assignees']),
    author: isString(author) ? author : null,
    createdAt,
    updatedAt,
    closedAt: isDate(closedAt) ? closedAt : null,
    stateReason: isString(stateReason) ? stateReason : null,
    comet: value['comet'] === true,
    prs: counts(value['prs']),
  };
}

const issuesOf = (value: unknown): Issue[] =>
  Array.isArray(value) ? value.map(parseIssue).filter((issue) => issue !== null) : [];

function totalOf(value: unknown, open: readonly Issue[], closed: readonly Issue[]): IssueTotals {
  const total = isObject(value) ? value : {};
  const count = (key: string, fallback: number): number =>
    isCount(total[key]) ? total[key] : fallback;
  return {
    open: count('open', open.length),
    closed: count('closed', closed.length),
    comets: count('comets', open.filter((issue) => issue.comet).length),
  };
}

/** Reads the report defensively; an issue that does not parse is left out. */
export function parseIssuesReport(value: unknown): IssuesReport | null {
  if (!isObject(value) || !isDate(value['generatedAt']) || !isString(value['repo'])) return null;
  if (!Array.isArray(value['open']) || !Array.isArray(value['closed'])) return null;
  const open = issuesOf(value['open']);
  const closed = issuesOf(value['closed']);
  return {
    generatedAt: value['generatedAt'],
    repo: value['repo'],
    days: isCount(value['days']) ? value['days'] : DEFAULT_DAYS,
    total: totalOf(value['total'], open, closed),
    open,
    closed,
  };
}
