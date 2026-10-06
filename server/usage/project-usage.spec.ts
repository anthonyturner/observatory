import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TOP_FOLDERS, foldFolders, projectUsage } from './project-usage.ts';
import { localDayKey } from './token-days.ts';
import type { AssistantMessage, ProjectUsage } from './usage-types.ts';

const NOW = new Date(2026, 8, 26, 15, 0).getTime();
const DAY = 24 * 3_600_000;
const DAYS = [localDayKey(NOW - DAY), localDayKey(NOW)];

const message = (cwd: string, at: number, session = 's1'): AssistantMessage => ({
  id: `${cwd}-${at}`,
  at,
  model: 'claude-opus-5',
  input: 1,
  output: 2,
  cacheRead: 10,
  cacheWrite: 3,
  session,
  cwd,
  tools: [],
});

const projectOf = (cwd: string) =>
  cwd.startsWith('/repos/app')
    ? { name: 'app', repo: 'me/app' }
    : { name: cwd.split('/').pop() ?? '', repo: null };

describe('projectUsage', () => {
  it('sums each project across its worktrees, day by day, busiest first', () => {
    const projects = projectUsage(
      [
        message('/repos/app', NOW),
        message('/repos/app/sub', NOW - DAY, 's2'),
        message('/scratch/notes', NOW),
      ],
      projectOf,
      DAYS,
    );

    assert.deepEqual(projects, [
      {
        name: 'app',
        repo: 'me/app',
        tokens: 12,
        cacheRead: 20,
        messages: 2,
        sessions: 2,
        daily: [6, 6],
      },
      {
        name: 'notes',
        repo: null,
        tokens: 6,
        cacheRead: 10,
        messages: 1,
        sessions: 1,
        daily: [0, 6],
      },
    ]);
  });

  it('leaves out messages from other days', () => {
    assert.deepEqual(projectUsage([message('/repos/app', NOW - 5 * DAY)], projectOf, DAYS), []);
  });
});

describe('foldFolders', () => {
  const folder = (name: string, tokens: number, repo: string | null = null): ProjectUsage => ({
    name,
    repo,
    tokens,
    cacheRead: 1,
    messages: 1,
    sessions: 1,
    daily: [tokens],
  });

  it('folds loose folders past the busiest into one row, keeping every repository', () => {
    const loose = Array.from({ length: TOP_FOLDERS + 2 }, (_, index) =>
      folder(`f${index}`, 100 - index),
    );
    const folded = foldFolders([folder('app', 1, 'me/app'), ...loose]);

    assert.equal(folded.length, TOP_FOLDERS + 2);
    assert.equal(folded[0].repo, 'me/app');
    assert.deepEqual(folded.at(-1), {
      name: '2 other folders',
      repo: null,
      folded: 2,
      tokens: 90 + 89,
      cacheRead: 2,
      messages: 2,
      sessions: 2,
      daily: [90 + 89],
    });
  });

  it('leaves a short list alone', () => {
    const list = [folder('a', 1)];
    assert.deepEqual(foldFolders(list), list);
  });
});
