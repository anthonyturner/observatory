import { cachedReads } from './app/api-reads.ts';
import { ROUTE_PATH, ownerRoutes, withAssistant } from './app/api-routes.ts';
import { jevAssistant } from './assistant/jev-assistant.ts';
import { localKey } from './assistant/open-router-key.ts';
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
import { guardLoopback } from './http/loopback-guard.ts';
import { createApiServer } from './http/api-server.ts';
import { withLocalSession } from './http/session.ts';
import { fsLogFolder } from './logs/log-folder.ts';
import { fileLogsConfig } from './logs/logs-config.ts';
import { logsReport } from './logs/logs-report.ts';
import { findClaude } from './runner/claude-command.ts';
import { localRunner, shutDownWithProcess } from './runner/local-runner.ts';
import { RUNS_PATH, withRunsRoutes } from './runner/runs-routes.ts';
import { fileStore } from './store/file-store.ts';
import { storeTriageStore } from './triage/triage-store.ts';
import { fileHandoffStore } from './agents/handoff-store.ts';
import { usageReport } from './usage/usage-report.ts';
import { elevenLabs } from './voice/eleven-labs.ts';
import { localElevenLabs } from './voice/eleven-labs-settings.ts';
import { SPEAK_PATH, VOICE_PATH, withVoiceRoutes } from './voice/voice-routes.ts';
import { fetchPage } from './reader/page-fetch.ts';
import { READ_PATH, withReaderRoutes } from './reader/reader-routes.ts';

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

const claude = findClaude();
// Only this server has a runner; the hosted API never does (ADR-0005).
const runner = localRunner({
  claude,
  projects: async () => (await reads.projects()).projects,
  clones,
});
shutDownWithProcess(runner);

const assistant = jevAssistant({
  key: localKey(),
  reads,
  skills: fileSkills(),
  where: 'local',
  shells: localShells(process.platform),
  runner,
});

const voiceSettings = localElevenLabs();
const voice = {
  voice: elevenLabs({ key: voiceSettings.key }),
  preferredVoice: voiceSettings.preferredVoice,
};

// Loopback only: the API reads files from this machine's home folder, acts as
// the account `gh` is signed in with, and runs Claude Code once the owner
// confirms a proposal.
/** Routes that run code or spend the owner's money: this machine's own page only. */
/** The reader fetches any public page on request, so only this machine's page may ask. */
const LOOPBACK_ONLY: ReadonlySet<string> = new Set([
  RUNS_PATH,
  ROUTE_PATH,
  VOICE_PATH,
  SPEAK_PATH,
  READ_PATH,
]);

const server = createApiServer(
  guardLoopback(
    createApiHandler(
      withLocalSession(
        withReaderRoutes(
          withVoiceRoutes(
            withAssistant(withRunsRoutes(ownerRoutes(reads, triage, editor), runner), assistant),
            voice,
          ),
          fetchPage,
        ),
      ),
    ),
    LOOPBACK_ONLY,
  ),
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
  console.log(
    claude
      ? `Tier-3 runs are on: ${claude.file}`
      : 'Tier-3 runs are off: claude is not on the PATH.',
  );
  console.log(
    voiceSettings.key
      ? 'The ElevenLabs voice is on.'
      : 'The ElevenLabs voice is off: no ELEVENLABS_API_KEY.',
  );
});
