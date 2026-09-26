import type { RouteTable } from '../http/api-handler.ts';
import { pullNumberFrom } from '../queue/pull-detail.ts';
import { repoNameFrom } from '../queue/repo-name.ts';
import { triageRequestFrom } from '../triage/triage.ts';
import type { TriageStore } from '../triage/triage-store.ts';
import { recordTriage, withTriage } from '../triage/triaged-queue.ts';
import type { ApiReads } from './api-reads.ts';

const repoOf = (query: URLSearchParams): string => repoNameFrom(query.get('repo'));

/** The API as its owner uses it: every report, and triage to read and write. */
export function ownerRoutes(reads: ApiReads, triage: TriageStore): RouteTable {
  return {
    get: {
      '/api/usage': () => reads.usage(),
      '/api/projects': () => reads.projects(),
      // Triage is merged in on every request, so an action shows at once.
      '/api/queue': async (query) =>
        withTriage(await reads.queue(repoOf(query)), triage, Date.now()),
      '/api/collisions': (query) => reads.collisions(repoOf(query)),
      '/api/history': (query) => reads.history(repoOf(query)),
      '/api/issues': (query) => reads.issues(repoOf(query)),
      '/api/logs': (query) => reads.logs(repoOf(query)),
      '/api/pull': (query) => reads.pull(repoOf(query), pullNumberFrom(query.get('number'))),
    },
    post: {
      '/api/triage': async (body) => {
        const request = triageRequestFrom(body);
        return recordTriage(request, await reads.queue(request.repo), triage, Date.now());
      },
    },
  };
}
