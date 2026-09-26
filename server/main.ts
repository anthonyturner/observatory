import { ghCliReader } from './github/gh-cli-reader.ts';
import { createApiServer } from './http/api-server.ts';
import { projectsReport } from './projects/projects-report.ts';
import { issuesReport } from './issues/issues-report.ts';
import { pullDetailOf, pullNumberFrom } from './queue/pull-detail.ts';
import { queueReport } from './queue/queue-report.ts';
import { repoNameFrom } from './queue/repo-name.ts';
import { triageRequestFrom } from './triage/triage.ts';
import { fileTriageStore } from './triage/triage-store.ts';
import { recordTriage, withTriage } from './triage/triaged-queue.ts';
import { usageReport } from './usage/usage-report.ts';
import { cached } from './util/cached.ts';
import { cachedByKey } from './util/cached-by-key.ts';

/** The port `ng serve` proxies `/api` to (proxy.conf.json). */
const DEFAULT_PORT = 4319;
/** GitHub is read at most this often; the page asks every few minutes. */
const PROJECTS_TTL_MS = 5 * 60_000;
/** A queue is looked at closely, so it is read more often. */
const QUEUE_TTL_MS = 2 * 60_000;
/** One pull request is read when it is opened, and again a minute later at most. */
const PULL_TTL_MS = 60_000;

const port = Number(process.env['OBSERVATORY_API_PORT'] ?? DEFAULT_PORT);
const github = ghCliReader();
const triage = fileTriageStore();
const queueOf = cachedByKey((repo) => queueReport(github, repo), QUEUE_TTL_MS);
const issuesOf = cachedByKey((repo) => issuesReport(github, repo), QUEUE_TTL_MS);
const pullOf = cachedByKey(async (key) => {
  const [repo, number] = key.split('#');
  return pullDetailOf(await github.pullDetail(repo, Number(number)));
}, PULL_TTL_MS);

// Loopback only: the API reads files from this machine's home folder and acts
// as the account `gh` is signed in with.
const server = createApiServer(
  {
    '/api/usage': () => usageReport(),
    '/api/projects': cached(() => projectsReport(github), PROJECTS_TTL_MS),
    // Triage is merged in on every request, so an action shows at once.
    '/api/queue': async (query) =>
      withTriage(await queueOf(repoNameFrom(query.get('repo'))), triage, Date.now()),
    '/api/issues': (query) => issuesOf(repoNameFrom(query.get('repo'))),
    '/api/pull': (query) =>
      pullOf(`${repoNameFrom(query.get('repo'))}#${pullNumberFrom(query.get('number'))}`),
  },
  {
    '/api/triage': async (body) => {
      const request = triageRequestFrom(body);
      return recordTriage(request, await queueOf(request.repo), triage, Date.now());
    },
  },
);

// Another copy already on the port would answer the page with its own, older
// code; say so and stop rather than sit idle behind it.
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code !== 'EADDRINUSE') throw error;
  console.error(
    `Port ${port} is already in use, most likely by an earlier Observatory API. ` +
      'Stop it (or set OBSERVATORY_API_PORT) and start again.',
  );
  process.exit(1);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Observatory API on http://127.0.0.1:${port}`);
});
