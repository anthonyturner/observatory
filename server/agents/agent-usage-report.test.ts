import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RawAgentRun } from './agent-runs.ts';
import { agentNameOf, agentUsageFrom, issueOf, totalsOf } from './agent-usage-report.ts';

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

  it('does not take a pull request’s number for an issue', () => {
    assert.equal(issueOf('qa', 'feat/618-roster', 'QA reviews PR #623'), 618);
    assert.equal(issueOf('qa', 'main', 'Review pull request #20'), null);
  });

  it('says nothing when neither names one', () => {
    assert.equal(issueOf('Explore', 'main', 'Find activity signals for Home'), null);
    assert.equal(issueOf('dev', 'main', 'Implement roster scale token 468'), null);
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
