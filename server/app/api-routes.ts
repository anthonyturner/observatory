import { editRequestFrom, editTargetFrom } from '../edits/edit-request.ts';
import type { PullEditor } from '../edits/pull-editor.ts';
import type { RouteTable } from '../http/api-handler.ts';
import { pullNumberFrom } from '../queue/pull-detail.ts';
import { repoNameFrom } from '../queue/repo-name.ts';
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
      '/api/projects': () => reads.projects(),
      // Triage is merged in on every request, so an action shows at once.
      '/api/queue': async (query) =>
        withTriage(await reads.queue(repoOf(query)), triage, Date.now()),
      '/api/collisions': (query) => reads.collisions(repoOf(query)),
      '/api/history': (query) => reads.history(repoOf(query)),
      '/api/ledger': (query) => reads.ledger(repoOf(query)),
      '/api/issues': (query) => reads.issues(repoOf(query)),
      '/api/agents': (query) => reads.agents(repoOf(query)),
      '/api/logs': (query) => reads.logs(repoOf(query)),
      '/api/pull': (query) => {
        const [repo, number] = [repoOf(query), numberOf(query)];
        // Refresh on the PR screen asks for it anew rather than a minute-old copy.
        if (query.get('fresh') === '1') reads.forgetPull(repo, number);
        return reads.pull(repo, number);
      },
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
