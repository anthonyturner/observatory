import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { checkoutFolderOf } from '../usage/checkout-projects.ts';
import { DETAIL_LIMIT_BYTES, sizeOf } from '../queue/pull-size.ts';
import { type ChangesSources, agentChangesReader, changesIn } from './agent-changes.ts';
import type { AgentChanges, ChangesDiff } from './agent-changes-types.ts';
import { type Git, GitTimedOut, readOnlyGit } from './read-only-git.ts';
import { cloneOf, commitAll, git, origin, recording, tempDir, write } from './testing/temp-repo.ts';

const SESSION = '11111111-1111-4111-8111-111111111111';
/** Every subcommand reading changes may run: none of them writes, and none reaches the network. */
const READ_ONLY_COMMANDS = new Set(['rev-parse', 'symbolic-ref', 'merge-base', 'diff', 'ls-files']);

function sources(gitRunner: Git = readOnlyGit()): ChangesSources {
  return {
    logsDir: tempDir('logs'),
    git: gitRunner,
    projectOf: () => ({ name: 'app', repo: 'me/app' }),
    checkoutFolderOf,
  };
}

function diffOf(changes: AgentChanges): ChangesDiff {
  assert.equal(changes.kind, 'diff', JSON.stringify(changes));
  return changes as ChangesDiff;
}

const problemOf = (changes: AgentChanges): string =>
  changes.kind === 'problem' ? changes.problem : 'diff';

/** A clone on `feat/x` with a committed, a staged, an unstaged and an untracked change. */
function busyClone(): { from: string; clone: string } {
  const from = origin();
  const clone = cloneOf(from);
  git(clone, 'checkout', '--quiet', '-b', 'feat/x');
  write(clone, 'committed.txt', 'committed\n');
  commitAll(clone, 'committed');
  write(clone, 'staged.txt', 'staged\n');
  git(clone, 'add', 'staged.txt');
  write(clone, 'base.txt', 'base\nunstaged\n');
  write(clone, 'untracked.txt', 'untracked\n');
  return { from, clone };
}

describe('changesIn', () => {
  it('covers committed, staged, unstaged and untracked files against the merge-base', async () => {
    const { from, clone } = busyClone();
    execSync('echo made by a shell> by-shell.txt', { cwd: clone });
    // origin moves on after the branch left it: that is not the agent's change.
    write(from, 'later-on-main.txt', 'later\n');
    commitAll(from, 'later');
    git(clone, 'fetch', '--quiet');

    const changes = diffOf(await changesIn({ cwd: clone, branch: 'feat/x' }, sources()));

    for (const file of [
      'committed.txt',
      'staged.txt',
      'base.txt',
      'untracked.txt',
      'by-shell.txt',
    ]) {
      assert.match(changes.diff, new RegExp(`^diff --git a/${file} b/${file}$`, 'm'), file);
    }
    assert.match(changes.diff, /^\+unstaged$/m);
    assert.doesNotMatch(changes.diff, /later-on-main/);
    assert.equal(changes.base, 'origin/main');
    assert.equal(changes.branch, 'feat/x');
    assert.equal(changes.repo, 'me/app');
    assert.equal(changes.isSharedCheckout, false);
    assert.equal(changes.isCommittedOnly, false);
  });

  it('only reads, and never fetches', async () => {
    const { clone } = busyClone();
    const recorder = recording(readOnlyGit());

    await changesIn({ cwd: clone, branch: 'feat/x' }, sources(recorder.git));

    assert.ok(recorder.calls.length > 0);
    for (const args of recorder.calls) assert.ok(READ_ONLY_COMMANDS.has(args[0]), args.join(' '));
    const diffs = recorder.calls.filter((args) => args[0] === 'diff');
    assert.ok(diffs.length > 0);
    for (const args of diffs)
      assert.equal(args.at(-1), '--', 'nothing after "--" is read as an option');
  });

  it('says there are no changes when the branch has none', async () => {
    const clone = cloneOf(origin());
    git(clone, 'checkout', '--quiet', '-b', 'feat/empty');

    const changes = diffOf(await changesIn({ cwd: clone, branch: 'feat/empty' }, sources()));

    assert.equal(changes.diff, '');
    assert.equal(changes.diffTruncated, false);
  });

  it('falls back from origin/HEAD to origin/main, then origin/master, then says there is no base', async () => {
    const onMain = cloneOf(origin('main'));
    git(onMain, 'remote', 'set-head', 'origin', '--delete');
    const onMaster = cloneOf(origin('master'));
    git(onMaster, 'remote', 'set-head', 'origin', '--delete');
    const noRemote = origin('trunk');

    const main = await changesIn({ cwd: onMain, branch: 'main' }, sources());
    const master = await changesIn({ cwd: onMaster, branch: 'master' }, sources());
    const none = await changesIn({ cwd: noRemote, branch: 'trunk' }, sources());

    assert.equal(diffOf(main).base, 'origin/main');
    assert.equal(diffOf(master).base, 'origin/master');
    assert.equal(problemOf(none), 'no-base');
  });

  it('warns when the folder is the primary checkout on the default branch, not in a worktree', async () => {
    const clone = cloneOf(origin());
    const worktree = join(clone, '.claude', 'worktrees', 'w');
    git(clone, 'worktree', 'add', '--quiet', worktree, 'HEAD');
    git(worktree, 'checkout', '--quiet', '-B', 'main-copy');

    const shared = diffOf(await changesIn({ cwd: clone, branch: 'main' }, sources()));
    const own = diffOf(await changesIn({ cwd: worktree, branch: 'main-copy' }, sources()));

    assert.equal(shared.isSharedCheckout, true);
    assert.equal(own.isSharedCheckout, false);
  });

  it('shows a removed worktree’s committed changes from the branch its checkout keeps', async () => {
    const clone = cloneOf(origin());
    const worktree = join(clone, '.claude', 'worktrees', 'gone');
    git(clone, 'worktree', 'add', '--quiet', '-b', 'feat/gone', worktree);
    write(worktree, 'kept.txt', 'kept\n');
    commitAll(worktree, 'kept');
    write(worktree, 'lost.txt', 'never committed\n');
    git(clone, 'worktree', 'remove', '--force', worktree);

    const kept = diffOf(await changesIn({ cwd: worktree, branch: 'feat/gone' }, sources()));
    const lost = await changesIn({ cwd: worktree, branch: 'feat/deleted' }, sources());

    assert.equal(kept.isCommittedOnly, true);
    assert.equal(kept.readFrom.replaceAll('\\', '/'), clone.replaceAll('\\', '/'));
    assert.match(kept.diff, /^diff --git a\/kept\.txt b\/kept\.txt$/m);
    assert.doesNotMatch(kept.diff, /lost\.txt/);
    assert.equal(problemOf(lost), 'folder-gone');
  });

  it('says a folder outside any repository is not a git repo', async () => {
    const plain = tempDir('plain');
    mkdirSync(join(plain, 'inner'));

    const changes = await changesIn({ cwd: join(plain, 'inner'), branch: null }, sources());

    assert.equal(problemOf(changes), 'not-a-repo');
  });

  it('tells a git failure from a timeout', async () => {
    const folder = tempDir('any');
    const failing: Git = async () => ({
      code: 128,
      stdout: '',
      stderr: 'fatal: bad',
      isCut: false,
    });
    const slow: Git = async (dir, args) => {
      throw new GitTimedOut(`git ${args[0]} timed out in ${dir}`);
    };

    assert.equal(
      problemOf(await changesIn({ cwd: folder, branch: null }, sources(failing))),
      'git-failed',
    );
    assert.equal(
      problemOf(await changesIn({ cwd: folder, branch: null }, sources(slow))),
      'timed-out',
    );
  });

  it('cuts a combined diff over 240 KiB short, at a line end, and says so', async () => {
    const { clone } = busyClone();
    const line = `${'x'.repeat(99)}\n`;
    for (let index = 0; index < 4; index++) write(clone, `big-${index}.txt`, line.repeat(1000));

    const changes = diffOf(await changesIn({ cwd: clone, branch: 'feat/x' }, sources()));

    assert.equal(changes.diffTruncated, true);
    assert.ok(changes.diffBytes > DETAIL_LIMIT_BYTES);
    assert.ok(sizeOf(changes) <= DETAIL_LIMIT_BYTES);
    const lastLine = changes.diff.slice(changes.diff.lastIndexOf('\n') + 1);
    assert.ok(!/^\+x*$/.test(lastLine) || lastLine === `+${'x'.repeat(99)}`, 'ends at a line end');
  });
});

describe('agentChangesReader', () => {
  it('reads the folder the transcript names, and says so when it names none', async () => {
    const { clone } = busyClone();
    const reading = sources();
    const project = join(reading.logsDir, 'e--repos-app');
    mkdirSync(project);
    const line = {
      type: 'user',
      cwd: clone,
      gitBranch: 'feat/x',
      timestamp: '2026-10-07T09:00:00Z',
    };
    write(project, `${SESSION}.jsonl`, `${JSON.stringify(line)}\n`);
    const reader = agentChangesReader(reading, () => Date.parse('2026-10-07T10:00:00Z'));

    const found = await reader.changes({ session: SESSION, agentId: null });
    const unknown = await reader.changes({ session: SESSION, agentId: 'abc' });

    assert.equal(found.generatedAt, '2026-10-07T10:00:00.000Z');
    assert.equal(diffOf(found.changes).folder, clone);
    assert.deepEqual(unknown.changes, { kind: 'problem', problem: 'no-folder', folder: null });
  });
});
