import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RawAgentRun } from './agent-runs.ts';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import type { EntryStore, FileEntries } from '../usage/file-cache.ts';
import {
  agentNameOf,
  agentUsageFrom,
  agentUsageReport,
  issueOf,
  pullOf,
  totalsOf,
} from './agent-usage-report.ts';

const NOW = new Date(2026, 8, 30, 12, 0).getTime();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const raw = (id: string, more: Partial<RawAgentRun> = {}): RawAgentRun => ({
  id,
  agentType: 'dev',
  description: '',
  session: 's1',
  cwd: 'E:\\repos\\observatory',
  branch: 'main',
  startedAt: NOW - 2 * HOUR,
  endedAt: NOW - HOUR,
  model: 'claude-opus-5-5',
  toolUses: 10,
  tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  workTokens: 1_000,
  peakContext: 50_000,
  ...more,
});

const projectOf = (cwd: string) =>
  cwd.endsWith('RivalsPulse')
    ? { name: 'RivalsPulse', repo: 'me/RivalsPulse' }
    : { name: 'observatory', repo: 'me/observatory' };

describe('agentNameOf', () => {
  it('drops a plugin namespace, so agent-playbook:dev and dev are one agent', () => {
    assert.equal(agentNameOf('agent-playbook:dev'), 'dev');
    assert.equal(agentNameOf('dev'), 'dev');
    assert.equal(agentNameOf('Explore'), 'Explore');
  });

  it('calls a run that names no agent unknown, never a guess', () => {
    assert.equal(agentNameOf(null), 'unknown');
    assert.equal(agentNameOf(''), 'unknown');
  });
});

describe('issueOf', () => {
  it('takes the issue the description names first, since the branch may be another change’s', () => {
    assert.equal(issueOf('dev', 'feat/618-roster', 'Dev implements #626 opacity slider'), 626);
    assert.equal(issueOf('dev', 'main', 'Implement issue 442'), 442);
    assert.equal(issueOf('refine', null, 'Approach for #368'), 368);
  });

  it('falls back to the issue the branch is named for', () => {
    assert.equal(issueOf('dev', 'feat/217-agent-usage', 'Build the charts'), 217);
  });

  it('ties a planning agent to an issue only when its task names one', () => {
    assert.equal(issueOf('pm', 'feat/618-roster', 'PM drafts roster opacity slider'), null);
    assert.equal(issueOf('refine', 'feat/618-roster', 'Refine issue 626'), 626);
  });

  it('does not take a pull request’s number for an issue, however it is written', () => {
    assert.equal(issueOf('qa', 'feat/618-roster', 'QA reviews PR #623'), 618);
    for (const task of [
      'Review pull request #20',
      'Check PRs #12',
      'PR: #12 again',
      'Read pull-request 9',
    ]) {
      assert.equal(issueOf('qa', 'main', task), null, task);
    }
    assert.equal(issueOf('qa', 'main', 'QA review of PR 20 for issue 19'), 19);
  });

  it('says nothing when neither names one', () => {
    assert.equal(issueOf('Explore', 'main', 'Find activity signals for Home'), null);
    assert.equal(issueOf('dev', 'main', 'Implement roster scale token 468'), null);
  });
});

describe('pullOf', () => {
  it('reads the pull request a task names, as a qa review does', () => {
    assert.equal(pullOf('QA review PR 648'), 648);
    assert.equal(pullOf('QA reviews PR #622'), 622);
    assert.equal(pullOf('Review pull request #20'), 20);
    assert.equal(pullOf('Implement issue 442'), null);
  });
});

describe('totalsOf', () => {
  it('adds each agent up, most work first', () => {
    const report = agentUsageFrom(
      [
        raw('a', { agentType: 'agent-playbook:dev', workTokens: 3_000, peakContext: 90_000 }),
        raw('b', {
          agentType: 'dev',
          workTokens: 1_000,
          peakContext: 30_000,
          startedAt: NOW - 3 * HOUR,
        }),
        raw('c', { agentType: 'qa', workTokens: 500 }),
      ],
      projectOf,
      NOW,
    );
    const [dev, qa] = totalsOf(report.runs);

    assert.equal(dev.agent, 'dev');
    assert.equal(dev.runs, 2);
    assert.equal(dev.workTokens, 4_000);
    assert.equal(dev.averageWorkTokens, 2_000);
    assert.equal(dev.peakContextMax, 90_000);
    assert.equal(dev.peakContextAverage, 60_000);
    assert.equal(dev.averageDurationMs, 1.5 * HOUR);
    assert.equal(qa.agent, 'qa');
  });
});

describe('agentUsageFrom', () => {
  const report = agentUsageFrom(
    [
      raw('old', { endedAt: NOW - 40 * DAY, startedAt: NOW - 40 * DAY - HOUR }),
      raw('pm', { agentType: 'pm', description: 'File issue 12', endedAt: NOW - 3 * HOUR }),
      raw('dev', { branch: 'feat/12-thing', cwd: 'E:\\repos\\RivalsPulse', workTokens: 9_000 }),
    ],
    projectOf,
    NOW,
  );

  it('keeps a run that ended just inside the window, and drops one that ended just before it', () => {
    const from = new Date(2026, 8, 1).getTime();
    const edges = agentUsageFrom(
      [
        raw('first', { startedAt: from - HOUR, endedAt: from }),
        raw('before', { startedAt: from - HOUR, endedAt: from - 1 }),
      ],
      projectOf,
      NOW,
    );

    assert.deepEqual(
      edges.runs.map((run) => run.id),
      ['first'],
    );
  });

  it('keeps the runs that ended in the month, newest first', () => {
    assert.deepEqual(
      report.runs.map((run) => run.id),
      ['dev', 'pm'],
    );
    assert.equal(report.days, 30);
  });

  it('places each run in its project and ties it to its issue', () => {
    const [dev, pm] = report.runs;

    assert.deepEqual([dev.project, dev.repo, dev.issue], ['RivalsPulse', 'me/RivalsPulse', 12]);
    assert.deepEqual([pm.project, pm.issue], ['observatory', 12]);
    assert.equal(dev.durationMs, HOUR);
    assert.equal(typeof dev.startedAt, 'string');
  });

  it('adds the agents up overall and per project, busiest project first', () => {
    assert.deepEqual(
      report.agents.map((agent) => agent.agent),
      ['dev', 'pm'],
    );
    assert.deepEqual(
      report.projects.map((project) => [project.project, project.agents.map((a) => a.agent)]),
      [
        ['RivalsPulse', ['dev']],
        ['observatory', ['pm']],
      ],
    );
  });
});

describe('agentUsageReport', () => {
  const logs = mkdtempSync(join(tmpdir(), 'agent-report-'));
  after(() => rmSync(logs, { recursive: true, force: true }));
  const subagents = join(logs, 'e--repos-observatory', 's1', 'subagents');
  mkdirSync(subagents, { recursive: true });
  const at = (minutes: number) => new Date(NOW - HOUR + minutes * 60_000).toISOString();
  const line = (entry: Record<string, unknown>) =>
    JSON.stringify({
      sessionId: 's1',
      cwd: 'E:\\repos\\observatory',
      gitBranch: 'feat/12-x',
      ...entry,
    });
  const reply = (id: string, minutes: number, input: number, output: number) =>
    line({
      type: 'assistant',
      timestamp: at(minutes),
      message: {
        id,
        model: 'claude-opus-5-5',
        usage: {
          input_tokens: input,
          output_tokens: output,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
        content: [{ type: 'tool_use', name: 'Read' }],
      },
    });
  const transcript = (id: string, agentType: string, description: string, replies: string[]) => {
    const lines = [line({ type: 'user', timestamp: at(0) }), ...replies];
    writeFileSync(join(subagents, `agent-${id}.jsonl`), lines.join('\n'));
    writeFileSync(
      join(subagents, `agent-${id}.meta.json`),
      JSON.stringify({ agentType, description }),
    );
  };
  transcript('d1', 'agent-playbook:dev', 'Implement issue 12', [
    reply('m1', 1, 1_000, 200),
    reply('m2', 9, 3_000, 300),
  ]);
  transcript('q1', 'qa', 'QA review PR 40', [reply('m3', 20, 2_000, 100)]);
  const memoryStore = (): EntryStore<never> => {
    let stored: FileEntries<never> = {};
    return {
      read: async () => stored,
      write: async (entries) => {
        stored = entries;
      },
    };
  };

  it('reads transcripts from disk into runs, tied to issue and pull request, and adds them up', async () => {
    const report = await agentUsageReport(
      {
        logsDir: logs,
        cache: memoryStore(),
        projectOf: () => ({ name: 'observatory', repo: 'me/observatory' }),
      },
      NOW,
    );
    const byId = new Map(report.runs.map((run) => [run.id, run]));

    assert.equal(report.runs.length, 2);
    assert.deepEqual(
      [byId.get('d1')?.agent, byId.get('d1')?.issue, byId.get('d1')?.pull],
      ['dev', 12, null],
    );
    assert.deepEqual(
      [byId.get('q1')?.agent, byId.get('q1')?.issue, byId.get('q1')?.pull],
      ['qa', 12, 40],
    );
    assert.equal(byId.get('d1')?.workTokens, 4_500);
    assert.equal(byId.get('d1')?.peakContext, 3_000);
    assert.deepEqual(
      report.agents.map((agent) => [agent.agent, agent.runs, agent.workTokens]),
      [
        ['dev', 1, 4_500],
        ['qa', 1, 2_100],
      ],
    );
    assert.equal(report.projects[0].repo, 'me/observatory');
  });
});
