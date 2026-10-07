import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import type { ProjectOf } from '../usage/project-usage.ts';
import { type LiveAgentSources, liveAgentReader } from './live-agents.ts';

const NOW = Date.UTC(2026, 9, 7, 12, 0);
const MINUTE = 60_000;
const SESSION = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const AGENT = 'a1b2c3d4e5f6a7b8c';
const CALL = 'toolu_spawn';
const clock = (): number => NOW;

const root = mkdtempSync(join(tmpdir(), 'live-agents-'));
after(() => rmSync(root, { recursive: true, force: true }));

const projectOf: ProjectOf = (cwd) => ({
  name: cwd.split(/[\\/]/).pop() ?? '',
  repo: cwd.includes('app') ? 'me/app' : null,
});

let folders = 0;
/** A fresh session logs folder holding one project folder. */
function logs(): { sources: LiveAgentSources; project: string } {
  const logsDir = join(root, `logs-${folders++}`);
  const project = join(logsDir, 'e--repos-app');
  mkdirSync(project, { recursive: true });
  return { sources: { logsDir, projectOf }, project };
}

const stamp = (minutesAgo: number): string => new Date(NOW - minutesAgo * MINUTE).toISOString();

const line = (type: string, minutesAgo: number, more: Record<string, unknown> = {}): string =>
  JSON.stringify({ type, timestamp: stamp(minutesAgo), cwd: 'E:\\repos\\app', ...more });

const reply = (minutesAgo: number, stop: string, more: Record<string, unknown> = {}): string =>
  line('assistant', minutesAgo, { message: { stop_reason: stop, content: [] }, ...more });

/** Writes `lines` to `file`, last modified `minutesAgo`. */
function write(file: string, lines: readonly string[], minutesAgo: number): void {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, `${lines.join('\n')}\n`);
  const at = new Date(NOW - minutesAgo * MINUTE);
  utimesSync(file, at, at);
}

const sessionFile = (project: string, session = SESSION): string =>
  join(project, `${session}.jsonl`);

const agentFile = (project: string, agentId = AGENT): string =>
  join(project, SESSION, 'subagents', `agent-${agentId}.jsonl`);

function writeSubagent(project: string, minutesAgo: number, meta: Record<string, unknown> = {}) {
  const file = agentFile(project);
  write(file, [line('user', minutesAgo, { message: { content: 'task' } })], minutesAgo);
  writeFileSync(
    file.replace(/\.jsonl$/, '.meta.json'),
    JSON.stringify({
      agentType: 'agent-playbook:ux',
      description: 'Design it',
      toolUseId: CALL,
      ...meta,
    }),
  );
}

const answer = (minutesAgo: number, result: Record<string, unknown> = { status: 'completed' }) =>
  line('user', minutesAgo, {
    message: { content: [{ type: 'tool_result', tool_use_id: CALL, content: 'report' }] },
    toolUseResult: result,
  });

describe('liveAgentReader list', () => {
  it('lists a session working, with its latest folder, branch, title and last tool', async () => {
    const { sources, project } = logs();
    write(
      sessionFile(project),
      [
        line('user', 5, { cwd: 'E:\\repos\\home', gitBranch: 'main', message: { content: 'go' } }),
        JSON.stringify({ type: 'ai-title', aiTitle: 'Build the list' }),
        reply(1, 'tool_use', {
          cwd: 'E:\\repos\\app-wt-490',
          gitBranch: 'feat/490-list',
          message: {
            stop_reason: 'tool_use',
            content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'src/a.ts' } }],
          },
        }),
      ],
      1,
    );

    const { agents } = await liveAgentReader(sources, clock).list();

    assert.deepEqual(agents, [
      {
        session: SESSION,
        agentId: null,
        agent: null,
        title: 'Build the list',
        project: 'app-wt-490',
        repo: 'me/app',
        branch: 'feat/490-list',
        folder: 'E:\\repos\\app-wt-490',
        state: 'working',
        quietMinutes: null,
        lastActiveAt: new Date(NOW - MINUTE).toISOString(),
        lastTool: 'Read src/a.ts',
        isHeadless: false,
      },
    ]);
  });

  it('reads waiting and quiet sessions, and drops one silent for over thirty minutes', async () => {
    const { sources, project } = logs();
    write(sessionFile(project), [line('user', 4), reply(4, 'end_turn')], 4);
    write(sessionFile(project, OTHER), [line('user', 14), reply(14, 'tool_use')], 14);
    write(sessionFile(project, '33333333-3333-4333-8333-333333333333'), [line('user', 31)], 31);

    const { agents } = await liveAgentReader(sources, clock).list();

    assert.deepEqual(
      agents.map((agent) => [agent.session, agent.state, agent.quietMinutes]).sort(),
      [
        [SESSION, 'waiting', null],
        [OTHER, 'quiet', 14],
      ].sort(),
    );
  });

  it('tags a claude -p session headless', async () => {
    const { sources, project } = logs();
    write(sessionFile(project), [line('user', 0, { entrypoint: 'sdk-cli' })], 0);

    assert.equal((await liveAgentReader(sources, clock).list()).agents[0].isHeadless, true);
  });

  it('lists a running subagent under its agent and task', async () => {
    const { sources, project } = logs();
    write(sessionFile(project), [line('user', 3), reply(3, 'tool_use')], 3);
    writeSubagent(project, 0);

    const subagent = (await liveAgentReader(sources, clock).list()).agents.find(
      (agent) => agent.agentId,
    );

    assert.equal(subagent?.agentId, AGENT);
    assert.equal(subagent?.agent, 'ux');
    assert.equal(subagent?.title, 'Design it');
    assert.equal(subagent?.state, 'working');
  });

  it('drops a subagent once its spawner holds the answer to the call that started it', async () => {
    const { sources, project } = logs();
    writeSubagent(project, 2);
    write(sessionFile(project), [line('user', 3), answer(1)], 1);

    const { agents } = await liveAgentReader(sources, clock).list();

    assert.deepEqual(
      agents.map((agent) => agent.agentId),
      [null],
    );
  });

  it('finds the answer even when the spawner has written megabytes since', async () => {
    const { sources, project } = logs();
    writeSubagent(project, 2);
    const chatter = line('user', 0, { message: { content: 'x'.repeat(1024 * 1024) } });
    write(sessionFile(project), [line('user', 3), answer(1), chatter], 0);

    const { agents } = await liveAgentReader(sources, clock).list();

    assert.equal(
      agents.some((agent) => agent.agentId === AGENT),
      false,
    );
  });

  it('keeps a background subagent, whose call is answered the moment it launches', async () => {
    const { sources, project } = logs();
    write(sessionFile(project), [line('user', 3), answer(3, { status: 'async_launched' })], 3);
    writeSubagent(project, 0);

    const { agents } = await liveAgentReader(sources, clock).list();

    assert.ok(agents.some((agent) => agent.agentId === AGENT));
  });

  it('drops a background subagent once its task is reported done, and keeps one resumed since', async () => {
    const notice = (minutesAgo: number) =>
      line('queue-operation', minutesAgo, {
        content: `<task-notification><task-id>${AGENT}</task-id><status>completed</status>`,
      });
    const done = logs();
    writeSubagent(done.project, 2);
    write(sessionFile(done.project), [line('user', 3), notice(1)], 1);
    const resumed = logs();
    writeSubagent(resumed.project, 0);
    write(sessionFile(resumed.project), [line('user', 3), notice(1)], 1);

    const isListed = async (sources: LiveAgentSources) =>
      (await liveAgentReader(sources, clock).list()).agents.some(
        (agent) => agent.agentId === AGENT,
      );

    assert.equal(await isListed(done.sources), false);
    assert.equal(await isListed(resumed.sources), true);
  });

  it('never lists bookkeeping, memory or tool results', async () => {
    const { sources, project } = logs();
    write(sessionFile(project), [line('file-history-snapshot', 0)], 0);
    write(join(project, 'memory', 'notes.jsonl'), [line('user', 0)], 0);
    write(join(project, SESSION, 'tool-results', 'x.jsonl'), [line('user', 0)], 0);

    assert.deepEqual((await liveAgentReader(sources, clock).list()).agents, []);
  });
});

describe('liveAgentReader one', () => {
  it('opens a finished subagent, saying it is not running', async () => {
    const { sources, project } = logs();
    writeSubagent(project, 2);
    write(sessionFile(project), [line('user', 3), answer(1)], 1);

    const { agent } = await liveAgentReader(sources, clock).one({
      session: SESSION,
      agentId: AGENT,
    });

    assert.equal(agent?.agent, 'ux');
    assert.equal(agent?.state, 'not-running');
  });

  it('opens a session long gone, and answers null for ids no transcript has', async () => {
    const { sources, project } = logs();
    write(sessionFile(project), [line('user', 600)], 600);

    const old = await liveAgentReader(sources, clock).one({ session: SESSION, agentId: null });
    const none = await liveAgentReader(sources, clock).one({ session: OTHER, agentId: null });

    assert.equal(old.agent?.state, 'not-running');
    assert.equal(none.agent, null);
  });
});
