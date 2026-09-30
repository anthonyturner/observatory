import type { ApiReads } from '../app/api-reads.ts';
import {
  Forbidden,
  NotFound,
  type PostRoutes,
  type RouteHandler,
  type RouteTable,
  type Routes,
} from '../http/api-handler.ts';
import type { ProjectsReport } from '../projects/project-types.ts';
import { NEWS_PATH } from '../news/news-routes.ts';
import { issueNumberFrom } from '../issues/issue-detail.ts';
import { pullNumberFrom } from '../queue/pull-detail.ts';
import { repoNameFrom } from '../queue/repo-name.ts';
import { EMPTY_TRIAGE } from '../triage/triage.ts';
import { triagedQueue } from '../triage/triaged-queue.ts';
import { redactStrings } from './redact.ts';

/** What the owner chose to show visitors. */
export interface PreviewPolicy {
  /** `PUBLIC_PREVIEW=all`: private repositories too. */
  readonly privateRepos: boolean;
  /** `PREVIEW_LOGS=on`: the logs, through the second scrub. */
  readonly logs: boolean;
}

/** The repositories a visitor may see, as lower-case `owner/name`. */
export type VisibleRepos = () => Promise<ReadonlySet<string>>;

export const PREVIEW_ONLY = 'This is a preview. Sign in to change anything.';
const LOGS_PATH = '/api/logs';

const refuse = async (): Promise<never> => {
  throw new Forbidden(PREVIEW_ONLY);
};

/** Every route in `routes` refused, so a route added later is closed to visitors until opened here. */
const refusingAll = <T extends Routes | PostRoutes>(routes: T): Record<string, typeof refuse> =>
  Object.fromEntries(Object.keys(routes).map((path) => [path, refuse]));

/** Only the projects a visitor may see, and only their pull requests among the directives. */
function visibleProjects(report: ProjectsReport, shown: ReadonlySet<string>): ProjectsReport {
  const projects = report.projects.filter((project) => shown.has(project.repo.toLowerCase()));
  const names = new Set(projects.map((project) => project.name));
  return {
    ...report,
    projects,
    directives: report.directives.filter((directive) => names.has(directive.project)),
  };
}

/**
 * The API as a visitor gets it: the charts of the repositories they may see,
 * and nothing of the owner's own. A repository they may not see answers as
 * one that does not exist, so not even its name is given away. Triage reads as
 * untouched, and every other route, every write among them, is refused.
 */
export function visitorRoutes(
  owner: RouteTable,
  reads: ApiReads,
  visible: VisibleRepos,
  policy: PreviewPolicy,
): RouteTable {
  const visibleRepo = async (query: URLSearchParams): Promise<string> => {
    const repo = repoNameFrom(query.get('repo'));
    if (!(await visible()).has(repo.toLowerCase())) throw new NotFound(`no star map for ${repo}`);
    return repo;
  };
  const ownerLogs = owner.get[LOGS_PATH];
  const ownerNews = owner.get[NEWS_PATH];
  // Public headlines, the same for everyone.
  const news: Routes = ownerNews ? { [NEWS_PATH]: ownerNews } : {};
  const logs: Routes =
    policy.logs && ownerLogs ? { [LOGS_PATH]: redactedLogs(ownerLogs, visible) } : {};
  return {
    get: {
      ...refusingAll(owner.get),
      // The owner's usage reads as none rather than as an error, as pr-starmap
      // answers a visitor's read of the owner's own documents.
      '/api/usage': async () => null,
      '/api/agent-usage': async () => null,
      '/api/projects': async () => visibleProjects(await reads.projects(), await visible()),
      '/api/queue': async (query) =>
        triagedQueue(await reads.queue(await visibleRepo(query)), EMPTY_TRIAGE, Date.now()),
      '/api/collisions': async (query) => reads.collisions(await visibleRepo(query)),
      '/api/history': async (query) => reads.history(await visibleRepo(query)),
      '/api/ledger': async (query) => reads.ledger(await visibleRepo(query)),
      '/api/issues': async (query) => reads.issues(await visibleRepo(query)),
      '/api/issue': async (query) =>
        reads.issue(await visibleRepo(query), issueNumberFrom(query.get('number'))),
      '/api/pull': async (query) =>
        reads.pull(await visibleRepo(query), pullNumberFrom(query.get('number'))),
      ...logs,
      ...news,
    },
    post: refusingAll(owner.post),
  };
}

/** The owner's logs through the second scrub; one repository's only if it is visible. */
function redactedLogs(ownerLogs: RouteHandler, visible: VisibleRepos): RouteHandler {
  return async (query) => {
    const repo = query.get('repo');
    if (repo !== null && !(await visible()).has(repoNameFrom(repo).toLowerCase())) {
      throw new NotFound(`no logs for ${repo}`);
    }
    return redactStrings(await ownerLogs(query));
  };
}
