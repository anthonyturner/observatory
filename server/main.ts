import { ghCliReader } from './github/gh-cli-reader.ts';
import { createApiServer } from './http/api-server.ts';
import { projectsReport } from './projects/projects-report.ts';
import { usageReport } from './usage/usage-report.ts';
import { cached } from './util/cached.ts';

/** The port `ng serve` proxies `/api` to (proxy.conf.json). */
const DEFAULT_PORT = 4319;
/** GitHub is read at most this often; the page asks every few minutes. */
const PROJECTS_TTL_MS = 5 * 60_000;

const port = Number(process.env['OBSERVATORY_API_PORT'] ?? DEFAULT_PORT);
const github = ghCliReader();

// Loopback only: the API reads files from this machine's home folder and acts
// as the account `gh` is signed in with.
createApiServer({
  '/api/usage': () => usageReport(),
  '/api/projects': cached(() => projectsReport(github), PROJECTS_TTL_MS),
}).listen(port, '127.0.0.1', () => {
  console.log(`Observatory API on http://127.0.0.1:${port}`);
});
