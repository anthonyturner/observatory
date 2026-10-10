import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { PullWorktrees } from './pull-worktrees.ts';
import type { ToolCall } from './tool-runner.ts';
import { nodeWorktreeFiles } from './worktree-files.ts';

let root = '';

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'observatory-pull-worktrees-'));
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

const exists = (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false,
  );

/** A clone on a real disk, with git replaced by a recorder, so only the deleting is real. */
function setUp(name: string) {
  const clone = join(root, name, 'clone');
  const calls: ToolCall[] = [];
  const worktrees = new PullWorktrees({
    tools: {
      run: async (call) => {
        calls.push(call);
        return { code: 0, stdout: '', lastLine: '', hasTimedOut: false };
      },
      shutdown: () => undefined,
    },
    files: nodeWorktreeFiles(),
    pulls: { isOpen: async () => true },
  });
  const folder = join(clone, '.claude', 'worktrees', 'observatory-pr-12');
  const admin = join(clone, '.git', 'worktrees', 'observatory-pr-12');
  /** A worktree as `git worktree add` leaves it, deep dependencies and all. */
  const makeWorktree = async (isMarked: boolean): Promise<void> => {
    await mkdir(join(folder, 'node_modules', 'pkg', 'lib'), { recursive: true });
    await writeFile(join(folder, 'node_modules', 'pkg', 'lib', 'index.js'), 'x');
    await writeFile(join(folder, '.git'), `gitdir: ${admin.replaceAll('\\', '/')}\n`);
    await mkdir(admin, { recursive: true });
    if (isMarked) await writeFile(join(admin, 'observatory-preview'), 'pull 12\n');
  };
  return { clone, folder, admin, calls, worktrees, makeWorktree };
}

describe('PullWorktrees on a real disk', () => {
  it('deletes a worktree whose node_modules holds a junction without touching what it points at', async () => {
    const { clone, folder, calls, worktrees, makeWorktree } = setUp('junction');
    const outside = join(root, 'junction', 'outside');
    await mkdir(join(outside, 'nested'), { recursive: true });
    await writeFile(join(outside, 'precious.txt'), 'keep');
    await writeFile(join(outside, 'nested', 'also.txt'), 'keep too');
    await makeWorktree(true);
    await symlink(outside, join(folder, 'node_modules', 'workspace-package'), 'junction');
    await symlink(outside, join(folder, 'linked'), 'junction');

    const problem = await worktrees.remove(clone, 12);

    assert.equal(problem, null);
    assert.equal(await exists(folder), false);
    assert.equal(await readFile(join(outside, 'precious.txt'), 'utf8'), 'keep');
    assert.equal(await readFile(join(outside, 'nested', 'also.txt'), 'utf8'), 'keep too');
    const asked = calls.map((call) => (call.tool === 'git' ? call.args.join(' ') : call.command));
    assert.ok(!asked.some((line) => line.includes('worktree remove')));
    assert.ok(asked.some((line) => line.endsWith('worktree prune')));
  });

  it('deletes a worktree that is itself a junction by removing the link only', async () => {
    const { clone, folder, worktrees } = setUp('linked-root');
    const elsewhere = join(root, 'linked-root', 'elsewhere');
    await mkdir(elsewhere, { recursive: true });
    await writeFile(join(elsewhere, 'keep.txt'), 'keep');
    await writeFile(join(elsewhere, '.git'), `gitdir: ${join(root, 'linked-root', 'admin')}\n`);
    await mkdir(join(root, 'linked-root', 'admin'), { recursive: true });
    await writeFile(join(root, 'linked-root', 'admin', 'observatory-preview'), 'pull 12\n');
    await mkdir(join(clone, '.claude', 'worktrees'), { recursive: true });
    await symlink(elsewhere, folder, 'junction');

    const problem = await worktrees.remove(clone, 12);

    assert.equal(problem, null);
    assert.equal(await exists(folder), false);
    assert.equal(await readFile(join(elsewhere, 'keep.txt'), 'utf8'), 'keep');
  });

  it('leaves a worktree it did not make exactly as it was', async () => {
    const { clone, folder, calls, worktrees, makeWorktree } = setUp('unmarked');
    await makeWorktree(false);
    await writeFile(join(folder, 'my-notes.txt'), 'uncommitted');

    const problem = await worktrees.remove(clone, 12);

    assert.match(problem ?? '', /in the way/);
    assert.equal(await readFile(join(folder, 'my-notes.txt'), 'utf8'), 'uncommitted');
    assert.equal(await exists(join(folder, 'node_modules', 'pkg', 'lib', 'index.js')), true);
    assert.deepEqual(calls, []);
  });

  it('treats a plain folder with a .git directory, such as a clone, as not its own', async () => {
    const { clone, folder, worktrees } = setUp('git-directory');
    await mkdir(join(folder, '.git'), { recursive: true });
    await writeFile(join(folder, 'file.txt'), 'x');

    const problem = await worktrees.remove(clone, 12);

    assert.match(problem ?? '', /in the way/);
    assert.equal(await exists(join(folder, 'file.txt')), true);
  });
});
