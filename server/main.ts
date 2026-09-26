import { cachedReads } from './app/api-reads.ts';
import { ownerRoutes, withAssistant } from './app/api-routes.ts';
import { assistantRouter } from './assistant/assistant-router.ts';
import { openRouter } from './assistant/open-router.ts';
import { localKey } from './assistant/open-router-key.ts';
import { projectsOf } from './assistant/projects-of.ts';
import { localShells } from './assistant/shell-commands.ts';
import { fileSkills } from './assistant/skills-file.ts';
import { fileCloneFinder } from './collisions/clone-finder.ts';
import { collisionsReport } from './collisions/collisions-report.ts';
import { gitPairMerger } from './collisions/pair-merger.ts';
import { storeEditStore } from './edits/edit-store.ts';
import { pullEditor } from './edits/pull-editor.ts';
import { ghCliReader } from './github/gh-cli-reader.ts';
import { fileHistoryStore } from './history/history-store.ts';
import { createApiHandler } from './http/api-handler.ts';
import { createApiServer } from './http/api-server.ts';
import { withLocalSession } from './http/session.ts';
import { fsLogFolder } from './logs/log-folder.ts';
import { fileLogsConfig } from './logs/logs-config.ts';
import { logsReport } from './logs/logs-report.ts';
import { fileStore } from './store/file-store.ts';
import { storeTriageStore } from './triage/triage-store.ts';
import { fileHandoffStore } from './agents/handoff-store.ts';
import { usageReport } from './usage/usage-report.ts';

/** The port `ng serve` proxies `/api` to (proxy.conf.json). */
const DEFAULT_PORT = 4319;

const port = Number(process.env['OBSERVATORY_API_PORT'] ?? DEFAULT_PORT);
const github = ghCliReader();
const clones = fileCloneFinder();
const merger = gitPairMerger();
const logsConfig = fileLogsConfig();
const logFolder = fsLogFolder();
const handoffs = fileHandoffStore();
const reads = cachedReads({
  github,
  history: fileHistoryStore(),
  collisions: (repo) => collisionsReport(github, clones, merger, repo),
  usage: () => usageReport(),
  logs: (repo) => logsReport(logsConfig, logFolder, repo, new Date()),
  handoffs: async () => handoffs.read(),
});
const store = fileStore();
const triage = storeTriageStore(store);
const editor = pullEditor({
  writer: github,
  labels: (repo) => reads.labels(repo),
  store: storeEditStore(store),
  changed: ({ repo, number }) => reads.forgetPull(repo, number),
  now: Date.now,
});
const assistant = assistantRouter({
  models: openRouter({ key: localKey() }),
  projects: async () => projectsOf(await reads.projects()),
  skills: fileSkills(),
  where: 'local',
  shells: localShells(process.platform),
  // Nothing runs a proposal here yet: each is only its command.
  runner: null,
});

// Loopback only: the API reads files from this machine's home folder and acts
// as the account `gh` is signed in with.
const server = createApiServer(
  createApiHandler(withLocalSession(withAssistant(ownerRoutes(reads, triage, editor), assistant))),
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
