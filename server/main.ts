import { agentSpeechReader } from './agent-speech/agent-speech-state.ts';
import { withAgentSpeechRoutes } from './agent-speech/agent-speech-routes.ts';
import { jevHold } from './agent-speech/jev-hold.ts';
import { cachedReads } from './app/api-reads.ts';
import { ownerRoutes, withAssistant } from './app/api-routes.ts';
import { jevAssistant } from './assistant/jev-assistant.ts';
import { localKey } from './assistant/open-router-key.ts';
import { openRouter } from './assistant/open-router.ts';
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
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { McpSessions } from './assistant/claude/mcp-sessions.ts';
import { MCP_PREFIX, withMcpEndpoint } from './assistant/claude/mcp-endpoint.ts';
import { claudeStarter } from './runner/claude-launcher.ts';
import { processTreeKiller } from './runner/process-tree.ts';
import { findClaude } from './runner/claude-command.ts';
import { localRunner, shutDownWithProcess } from './runner/local-runner.ts';
import { withRunsRoutes } from './runner/runs-routes.ts';
import { withCrewRoutes } from './crew/crew-routes.ts';
import { withRiskRoutes } from './queue/risk-routes.ts';
import { riskSummaries } from './queue/risk-summary.ts';
import { fileStore } from './store/file-store.ts';
import { storeTriageStore } from './triage/triage-store.ts';
import { fileHandoffStore } from './agents/handoff-store.ts';
import { usageReport } from './usage/usage-report.ts';
import { agentUsageReport } from './agents/agent-usage-report.ts';
import { elevenLabs } from './voice/eleven-labs.ts';
import { localElevenLabs } from './voice/eleven-labs-settings.ts';
import { withVoiceRoutes } from './voice/voice-routes.ts';
import { fetchPage } from './reader/page-fetch.ts';
import { withReaderRoutes } from './reader/reader-routes.ts';
import { cachedNews, withNewsRoutes } from './news/news-routes.ts';
import { fileArchitecture } from './architecture/architecture-file.ts';
import { withArchitectureRoutes } from './architecture/architecture-routes.ts';
import { imapInbox } from './mail/imap-inbox.ts';
import { imapflowClient } from './mail/imapflow-client.ts';
import { withMailRoutes } from './mail/mail-routes.ts';
import { localMailLogin } from './mail/mail-settings.ts';
import { mailboxes } from './mail/mailboxes.ts';
import { MAIL_ACCOUNTS } from './mail/mail-types.ts';
import { LOOPBACK_FORMAT, wasapiLoopback } from './sound-card/loopback-helper.ts';
import { SoundCardCapture } from './sound-card/sound-card-capture.ts';
import { withSoundCardRoutes } from './sound-card/sound-card-routes.ts';

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
  agentUsage: () => agentUsageReport(),
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

// Jev thinks on the owner's Claude Code subscription when there is a
// `claude` to start; OpenRouter is left for a machine without one.
const mcpSessions = new McpSessions();
const killer = processTreeKiller();
const openRouterKey = localKey();
const assistant = jevAssistant({
  key: openRouterKey,
  reads,
  skills: fileSkills(),
  where: 'local',
  shells: localShells(process.platform),
  runner,
  claude: claude && {
    start: claudeStarter(claude),
    stop: (pid) => killer.stop(pid),
    sessions: mcpSessions,
    mcpUrl: (token) => `http://127.0.0.1:${port}${MCP_PREFIX}${token}`,
    scratch: join(tmpdir(), 'observatory-jev'),
  },
});

// A star's one-line summary comes from the same OpenRouter key as Jev; with none, the risk rules stand alone.
const summaries = riskSummaries(openRouter({ key: openRouterKey }));

// Read once at start, so the first visit to Home finds the news and its summaries waiting.
const news = cachedNews();

const voiceSettings = localElevenLabs();
const voice = {
  voice: elevenLabs({ key: voiceSettings.key }),
  preferredVoice: voiceSettings.preferredVoice,
};

const agentSpeech = { speech: agentSpeechReader(), hold: jevHold() };

const mailLogins = { icloud: localMailLogin('icloud'), gmail: localMailLogin('gmail') };
const mail = mailboxes({ logins: mailLogins, fetchInbox: imapInbox(imapflowClient) });

// Windows loopback is the only capture written so far; macOS and Linux need their own.
const soundCard = {
  capture: new SoundCardCapture(wasapiLoopback()),
  format: LOOPBACK_FORMAT,
  isAvailable: process.platform === 'win32',
};

// The MCP endpoint sits outside the loopback guard: Claude Code posts to it
// with no Origin, so it checks the Host and its own session token instead.
const server = createApiServer(
  withMcpEndpoint(
    guardLoopback(
      createApiHandler(
        withLocalSession(
          withSoundCardRoutes(
            withMailRoutes(
              withReaderRoutes(
                withVoiceRoutes(
                  withAssistant(
                    withCrewRoutes(
                      withRunsRoutes(
                        withNewsRoutes(
                          withArchitectureRoutes(
                            withAgentSpeechRoutes(
                              withRiskRoutes(
                                ownerRoutes(reads, triage, editor),
                                reads.pull,
                                summaries,
                              ),
                              agentSpeech,
                            ),
                            fileArchitecture(),
                          ),
                          news,
                        ),
                        runner,
                      ),
                      reads,
                      runner,
                    ),
                    assistant,
                  ),
                  voice,
                ),
                fetchPage,
              ),
              mail,
            ),
            soundCard,
          ),
        ),
      ),
    ),
    mcpSessions,
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
  void news().catch(() => undefined);
  console.log(`Observatory API on http://127.0.0.1:${port}`);
  console.log(
    claude
      ? `Tier-3 runs are on: ${claude.file}`
      : 'Tier-3 runs are off: claude is not on the PATH.',
  );
  console.log(
    voiceSettings.key
      ? 'The ElevenLabs voice is on.'
      : 'The ElevenLabs voice is off: no ELEVENLABS_OBSERVATORY_KEY.',
  );
  const mailStates = MAIL_ACCOUNTS.map(
    (account) => `${account} ${mailLogins[account] ? 'on' : 'off'}`,
  );
  console.log(`Mail: ${mailStates.join(', ')}.`);
});
