/** Where a notification's subject lives on GitHub's site, and its number when it has one. */
export interface SubjectPage {
  readonly url: string;
  /** A pull request's or issue's number; null for any other subject. */
  readonly number: number | null;
}

const API_REPOS = 'https://api.github.com/repos/';
const GITHUB = 'https://github.com';

/** An API path's collection, and the web page's name for the same thing. */
const WEB_COLLECTIONS: Readonly<Record<string, string>> = {
  pulls: 'pull',
  issues: 'issues',
  commits: 'commit',
  discussions: 'discussions',
};
/** The collections whose items are numbered pull requests and issues. */
const NUMBERED = new Set(['pulls', 'issues']);

/** Where a subject with no page of its own is listed, by GitHub's subject type. */
const LIST_PAGES: Readonly<Record<string, string>> = {
  CheckSuite: 'actions',
  WorkflowRun: 'actions',
  Release: 'releases',
  RepositoryVulnerabilityAlert: 'security',
  RepositoryDependabotAlertsThread: 'security/dependabot',
};

const NAME_PART = /^[A-Za-z0-9._-]+$/;
const DIGITS = /^\d+$/;

/** `owner/name/collection/id` from an API URL of the repository's, or null for any other URL. */
function apiPartsOf(apiUrl: string | null): readonly string[] | null {
  if (!apiUrl?.startsWith(API_REPOS)) return null;
  const parts = apiUrl.slice(API_REPOS.length).split('/');
  return parts.length === 4 && parts.every((part) => NAME_PART.test(part)) ? parts : null;
}

/** The repository's own list of such subjects, or the repository, for a subject with no page. */
function listPageOf(repo: string, subjectType: string): string {
  const list = LIST_PAGES[subjectType];
  return list ? `${GITHUB}/${repo}/${list}` : `${GITHUB}/${repo}`;
}

/**
 * The web page for a notification's subject, from its API URL: GitHub gives
 * `https://api.github.com/repos/o/r/pulls/5` where the page is
 * `https://github.com/o/r/pull/5`. A CI run has no URL and a release's page
 * is named by its tag, not its id, so those open the repository's list.
 */
export function subjectPageOf(
  repo: string,
  subjectType: string,
  apiUrl: string | null,
): SubjectPage {
  const parts = apiPartsOf(apiUrl);
  const [owner, name, collection, id] = parts ?? [];
  const page = collection ? WEB_COLLECTIONS[collection] : undefined;
  if (!page) return { url: listPageOf(repo, subjectType), number: null };
  const isNumbered = NUMBERED.has(collection) && DIGITS.test(id);
  return {
    url: `${GITHUB}/${owner}/${name}/${page}/${id}`,
    number: isNumbered ? Number(id) : null,
  };
}
