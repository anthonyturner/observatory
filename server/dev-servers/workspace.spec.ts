import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PullPrepareRequest } from './pull-worktrees.ts';
import { localWorkspaces } from './workspace.ts';

function setUp() {
  const prepared: PullPrepareRequest[] = [];
  const removed: { clone: string; pull: number }[] = [];
  const stopped: string[] = [];
  const workspaces = localWorkspaces({
    prepare: async (request) => {
      prepared.push(request);
      return { folder: 'E:/clone/.claude/worktrees/observatory-pr-7' };
    },
    remove: async (clone, pull) => {
      removed.push({ clone, pull });
      return null;
    },
    shutdown: () => void stopped.push('worktrees'),
  });
  return { workspaces, prepared, removed, stopped };
}

describe('localWorkspaces', () => {
  it('runs a project’s own target in its checkout, and has nothing to give back', async () => {
    const { workspaces, prepared, removed } = setUp();
    const workspace = workspaces.of({ repo: 'me/app' });

    const folder = await workspace.prepare('E:/clone', {
      signal: new AbortController().signal,
      onPhase: () => undefined,
      isBusy: () => false,
    });

    assert.deepEqual(folder, { folder: 'E:/clone' });
    assert.equal(await workspace.release('E:/clone'), null);
    assert.deepEqual(
      [workspace.firstPhase, workspace.isQuick, workspace.leavesFiles],
      ['starting', true, false],
    );
    assert.deepEqual([prepared, removed], [[], []]);
  });

  it('runs a pull request in a worktree, asks whether others are busy as targets of the same project, and removes it on release', async () => {
    const { workspaces, prepared, removed } = setUp();
    const workspace = workspaces.of({ repo: 'me/app', pull: 7 });
    const asked: unknown[] = [];

    const result = await workspace.prepare('E:/clone', {
      signal: new AbortController().signal,
      onPhase: () => undefined,
      isBusy: (target) => (asked.push(target), target.pull === 3),
    });
    await workspace.release('E:/clone');

    assert.deepEqual(result, { folder: 'E:/clone/.claude/worktrees/observatory-pr-7' });
    assert.deepEqual(
      [prepared[0]?.repo, prepared[0]?.clone, prepared[0]?.pull],
      ['me/app', 'E:/clone', 7],
    );
    assert.deepEqual([prepared[0]?.isInUse(3), prepared[0]?.isInUse(4)], [true, false]);
    assert.deepEqual(asked, [
      { repo: 'me/app', pull: 3 },
      { repo: 'me/app', pull: 4 },
    ]);
    assert.deepEqual(removed, [{ clone: 'E:/clone', pull: 7 }]);
    assert.deepEqual(
      [workspace.firstPhase, workspace.isQuick, workspace.leavesFiles],
      ['fetching', false, true],
    );
  });

  it('ends what the worktrees are running when shut down', () => {
    const { workspaces, stopped } = setUp();

    workspaces.shutdown();

    assert.deepEqual(stopped, ['worktrees']);
  });
});
