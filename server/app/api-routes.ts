import { runIdFrom } from '../actions/actions-rerun.ts';
import type { AssistantRouter } from '../assistant/assistant-router.ts';
import { routeRequestFrom } from '../assistant/route-request.ts';
import { editRequestFrom, editTargetFrom } from '../edits/edit-request.ts';
import type { PullEditor } from '../edits/pull-editor.ts';
import type { RouteTable } from '../http/api-handler.ts';
import { isFresh } from '../http/fresh-query.ts';
import { issueNumberFrom } from '../issues/issue-detail.ts';
import { commitShaFrom } from '../queue/commit-diff.ts';
import { pullNumberFrom } from '../queue/pull-detail.ts';
import { repoNameFrom } from '../queue/repo-name.ts';
import { WEATHER_PATH } from '../queue/pull-weather.ts';
import { withSinceLook } from '../queue/since-look.ts';
import { triageRequestFrom } from '../triage/triage.ts';
import type { TriageStore } from '../triage/triage-store.ts';
import { recordTriage, withTriage } from '../triage/triaged-queue.ts';
import type { ApiReads } from './api-reads.ts';

const repoOf = (query: URLSearchParams): string => repoNameFrom(query.get('repo'));
const numberOf = (query: URLSearchParams): number => pullNumberFrom(query.get('number'));

/** A description may be up to 65,536 characters, and JSON can take several bytes for each. */
const EDIT_BODY_LIMIT_BYTES = 512 * 1024;

/** The API as its owner uses it: every report, triage to read and write, and pull request edits. */
export function ownerRoutes(reads: ApiReads, triage: TriageStore, editor: PullEditor): RouteTable {
  return {
    get: {
      '/api/usage': () => reads.usage(),
      '/api/agent-usage': () => reads.agentUsage(),
      '/api/projects': (query) => {
        if (isFresh(query)) reads.forgetProjects();
        return reads.projects();
      },
      // Triage is merged in on every request, so an action shows at once.
      '/api/queue': async (query) => {
        const repo = repoOf(query);
        if (isFresh(query)) reads.forgetQueue(repo);
        const triaged = await withTriage(await reads.queue(repo), triage, Date.now());
        return withSinceLook(triaged, (base, head) => reads.sinceLook(repo, base, head));
      },
      '/api/collisions': (query) => reads.collisions(repoOf(query)),
      '/api/history': (query) => reads.history(repoOf(query)),
      '/api/ledger': (query) => reads.ledger(repoOf(query)),
      '/api/releases': (query) => reads.releases(repoOf(query)),
      '/api/journal': (query) => reads.journal(repoOf(query)),
      '/api/library': (query) => reads.library(repoOf(query)),
      '/api/actions': (query) => {
        const repo = repoOf(query);
        if (isFresh(query)) reads.forgetActions(repo);
        return reads.actions(repo);
      },
      '/api/actions/run': (query) => reads.runJobs(repoOf(query), runIdFrom(query.get('run'))),
      '/api/ci-health': (query) => reads.ciHealth(repoOf(query)),
      '/api/security': (query) => reads.security(repoOf(query)),
      '/api/issues': (query) => {
        const repo = repoOf(query);
        if (isFresh(query)) reads.forgetIssues(repo);
        return reads.issues(repo);
      },
      '/api/agents': (query) => reads.agents(repoOf(query)),
      '/api/issue': (query) => {
        const [repo, number] = [repoOf(query), issueNumberFrom(query.get('number'))];
        // Refresh in the issue window asks for it anew rather than a minute-old copy.
        if (isFresh(query)) reads.forgetIssue(repo, number);
        return reads.issue(repo, number);
      },
      '/api/logs': (query) => reads.logs(repoOf(query)),
      '/api/pull': (query) => {
        const [repo, number] = [repoOf(query), numberOf(query)];
        // Refresh on the PR screen asks for it anew rather than a minute-old copy.
        if (isFresh(query)) reads.forgetPull(repo, number);
        return reads.pull(repo, number);
      },
      '/api/pull-state': (query) => reads.pullState(repoOf(query), numberOf(query)),
      [WEATHER_PATH]: (query) => reads.weather(repoOf(query)),
      '/api/commit': (query) => reads.commit(repoOf(query), commitShaFrom(query.get('sha'))),
      '/api/since-look': (query) =>
        reads.sinceLookDiff(
          repoOf(query),
          commitShaFrom(query.get('base')),
          commitShaFrom(query.get('head')),
        ),
      '/api/labels': (query) => reads.labels(repoOf(query)),
      '/api/edit': (query) => editor.read({ repo: repoOf(query), number: numberOf(query) }),
    },
    post: {
      '/api/triage': async (body) => {
        const request = triageRequestFrom(body);
        return recordTriage(request, await reads.queue(request.repo), triage, Date.now());
      },
      '/api/edit': (body) => editor.apply(editRequestFrom(body)),
      '/api/edit/clear': async (body) => {
        await editor.clear(editTargetFrom(body));
        return null;
      },
    },
    bodyLimits: { '/api/edit': EDIT_BODY_LIMIT_BYTES },
  };
}

const ROUTE_PATH = '/api/route';

/** `table` with Home's assistant: what it can do, and where a request goes. */
export function withAssistant(table: RouteTable, assistant: AssistantRouter): RouteTable {
  return {
    ...table,
    get: { ...table.get, [ROUTE_PATH]: () => assistant.status() },
    post: { ...table.post, [ROUTE_PATH]: (body) => assistant.route(routeRequestFrom(body)) },
  };
}
