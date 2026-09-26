import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { type AgentPull, type Handoff, reportCards } from './agents-report.ts';
import { handoffOf } from './capture.ts';
import { fileHandoffStore } from './handoff-store.ts';

const handoffs: Handoff[] = [
  {
    at: '2026-09-20T10:00:00Z',
    kind: 'pr-opened',
    session: 's1',
    agent: 'dev',
    pr: 1,
    url: 'https://github.com/me/a/pull/1',
  },
  {
    at: '2026-09-21T10:00:00Z',
    kind: 'pr-opened',
    session: 's2',
    agent: null,
    pr: 2,
    url: 'https://github.com/me/a/pull/2',
  },
  { at: '2026-09-21T10:05:00Z', kind: 'agent-stop', session: 's2', agent: 'dev' },
  {
    at: '2026-09-22T10:00:00Z',
    kind: 'pr-opened',
    session: 's3',
    agent: null,
    pr: 3,
    url: 'https://github.com/me/a/pull/3',
  },
  { at: '2026-09-22T11:00:00Z', kind: 'agent-stop', session: 's3', agent: 'qa' },
  {
    at: '2026-09-23T10:00:00Z',
    kind: 'pr-opened',
    session: 's4',
    agent: 'dev',
    pr: 9,
    url: 'https://github.com/other/b/pull/9',
  },
];

const pulls: AgentPull[] = [
  {
    number: 1,
    state: 'MERGED',
    mergeable: 'UNKNOWN',
    createdAt: '2026-09-20T10:00:00Z',
    mergedAt: '2026-09-20T16:00:00Z',
    closedAt: '2026-09-20T16:00:00Z',
    additions: 10,
    deletions: 2,
    closingIssuesReferences: [{ number: 5 }],
  },
  {
    number: 2,
    state: 'OPEN',
    mergeable: 'CONFLICTING',
    createdAt: '2026-09-21T10:00:00Z',
    mergedAt: null,
    closedAt: null,
    additions: 100,
    deletions: 0,
    closingIssuesReferences: [],
  },
  {
    number: 3,
    state: 'CLOSED',
    mergeable: 'UNKNOWN',
    createdAt: '2026-09-22T10:00:00Z',
    mergedAt: null,
    closedAt: '2026-09-23T10:00:00Z',
    additions: 5,
    deletions: 5,
    closingIssuesReferences: null,
  },
];

describe('reportCards', () => {
  it('grades and counts each agent exactly as pr-starmap’s reportCardsFrom does', () => {
    const report = reportCards(handoffs, pulls, 'me/a', Date.parse('2026-09-26T00:00:00Z'));

    // pr-starmap's bin/agents.mjs, run on the same handoffs and pull requests.
    assert.deepEqual(
      { ...report, generatedAt: undefined },
      {
        generatedAt: undefined,
        repo: 'me/a',
        since: '2026-09-20T10:00:00Z',
        attributed: 3,
        agents: [
          {
            agent: 'dev',
            basis: 'named and inferred',
            prs: [1, 2],
            opened: 2,
            merged: 1,
            closed: 0,
            open: 1,
            conflicting: 1,
            unlinked: 1,
            medianMergeHours: 6,
            medianLines: 56,
          },
          {
            agent: 'main session',
            basis: 'unattributed',
            prs: [3],
            opened: 1,
            merged: 0,
            closed: 1,
            open: 0,
            conflicting: 0,
            unlinked: 1,
            medianMergeHours: null,
            medianLines: 10,
          },
        ],
      },
    );
  });

  it('has no cards without a handoff for this repository', () => {
    assert.deepEqual(reportCards([], pulls, 'me/a').agents, []);
  });
});

describe('handoffOf', () => {
  const NOW = Date.parse('2026-09-26T12:00:00Z');

  it('records a pull request the moment gh pr create returns its link', () => {
    assert.deepEqual(
      handoffOf(
        {
          hook_event_name: 'PostToolUse',
          session_id: 's1',
          cwd: '/w',
          agent_type: 'dev',
          tool_input: { command: 'gh pr create --title x' },
          tool_response: { stdout: 'https://github.com/me/a/pull/42\n' },
        },
        NOW,
      ),
      {
        at: new Date(NOW).toISOString(),
        session: 's1',
        cwd: '/w',
        agent: 'dev',
        kind: 'pr-opened',
        pr: 42,
        url: 'https://github.com/me/a/pull/42',
      },
    );
  });

  it('records an agent finishing, and ignores every other command', () => {
    assert.equal(
      handoffOf({ hook_event_name: 'SubagentStop', session_id: 's1' }, NOW)?.kind,
      'agent-stop',
    );
    assert.equal(
      handoffOf({ hook_event_name: 'PostToolUse', tool_input: { command: 'git status' } }, NOW),
      null,
    );
  });
});

describe('fileHandoffStore', () => {
  it('reads back what it appended, and skips a torn line', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'observatory-handoffs-')), 'handoffs.jsonl');
    const store = fileHandoffStore(file);
    store.append(handoffs[0]);
    writeFileSync(file, `${JSON.stringify(handoffs[0])}\n{"at":`);

    assert.deepEqual(store.read(), [handoffs[0]]);
  });
});
