import { createApiServer } from './http/api-server.ts';
import { usageReport } from './usage/usage-report.ts';

/** The port `ng serve` proxies `/api` to (proxy.conf.json). */
const DEFAULT_PORT = 4319;
const port = Number(process.env['OBSERVATORY_API_PORT'] ?? DEFAULT_PORT);

// Loopback only: the API reads files from this machine's home folder.
createApiServer({ '/api/usage': () => usageReport() }).listen(port, '127.0.0.1', () => {
  console.log(`Observatory API on http://127.0.0.1:${port}`);
});
