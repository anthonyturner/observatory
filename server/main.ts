import { ghCliReader } from './github/gh-cli-reader.ts';
import { createApiServer } from './http/api-server.ts';
import { projectsReport } from './projects/projects-report.ts';
import { fileHistoryStore } from './history/history-store.ts';
import { recordFrame } from './history/record-frame.ts';
import { fileCloneFinder } from './collisions/clone-finder.ts';
import { collisionsReport } from './collisions/collisions-report.ts';
import { gitPairMerger } from './collisions/pair-merger.ts';
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
/** Merging every pair in a clone takes a while: at most every ten minutes. */
const COLLISIONS_TTL_MS = 10 * 60_000;

const port = Number(process.env['OBSERVATORY_API_PORT'] ?? DEFAULT_PORT);
const github = ghCliReader();
const triage = fileTriageStore();
const history = fileHistoryStore();
const clones = fileCloneFinder();
const merger = gitPairMerger();
const collisionsOf = cachedByKey(
  (repo) => collisionsReport(github, clones, merger, repo),
  COLLISIONS_TTL_MS,
);
// Each read from GitHub may add a frame to the star map's memory. A failure to
// record is logged, never passed on: the queue itself was read.
const queueOf = cachedByKey(async (repo) => {
  const report = await queueReport(github, repo);
  await recordFrame(report, history, github, Date.now()).catch((error: unknown) =>
    console.error(`Could not record ${repo}'s history:`, error),
  );
  return report;
}, QUEUE_TTL_MS);
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
    '/api/collisions': (query) => collisionsOf(repoNameFrom(query.get('repo'))),
    '/api/history': async (query) => {
      const repo = repoNameFrom(query.get('repo'));
      return { repo, frames: history.read(repo) };
    },
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
