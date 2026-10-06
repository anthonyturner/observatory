import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { rememberProjects, resolveProject } from './checkout-projects.ts';

const ORIGIN = '[remote "origin"]\n\turl = https://github.com/Me/App.git\n';

/** A checkout of me/app at `<root>/app`, with a worktree `<root>/app-wt-fix`. */
function checkouts() {
  const root = mkdtempSync(join(tmpdir(), 'observatory-checkouts-'));
  const app = join(root, 'app');
  const gitDir = join(app, '.git');
  const ownGitDir = join(gitDir, 'worktrees', 'app-wt-fix');
  const worktree = join(root, 'app-wt-fix');
  mkdirSync(join(app, 'src'), { recursive: true });
  mkdirSync(ownGitDir, { recursive: true });
  mkdirSync(worktree);
  writeFileSync(join(gitDir, 'config'), ORIGIN);
  writeFileSync(join(ownGitDir, 'commondir'), '../..\n');
  writeFileSync(join(worktree, '.git'), `gitdir: ${ownGitDir}\n`);
  return { root, app, worktree };
}

describe('resolveProject', () => {
  it('finds the GitHub repository a folder inside a checkout belongs to', () => {
    const { app } = checkouts();
    assert.deepEqual(resolveProject(join(app, 'src')), { name: 'app', repo: 'me/app' });
  });

  it('follows a worktree back to its checkout', () => {
    const { worktree } = checkouts();
    assert.deepEqual(resolveProject(worktree), { name: 'app', repo: 'me/app' });
  });

  it('knows a removed worktree by its name, or by where it was', () => {
    const { root, app } = checkouts();
    assert.deepEqual(resolveProject(join(root, 'app-wt-gone')), { name: 'app', repo: 'me/app' });
    assert.deepEqual(resolveProject(join(app, '.claude', 'worktrees', 'gone')), {
      name: 'app',
      repo: 'me/app',
    });
  });

  it('names any other folder by itself', () => {
    const { root } = checkouts();
    const loose = join(root, 'notes');
    mkdirSync(loose);
    assert.deepEqual(resolveProject(loose), { name: 'notes', repo: null });
    assert.deepEqual(resolveProject(''), { name: 'home', repo: null });
  });
});

describe('rememberProjects', () => {
  it('resolves each folder once', () => {
    let calls = 0;
    const projectOf = rememberProjects((cwd) => {
      calls++;
      return { name: cwd, repo: null };
    });

    projectOf('a');
    projectOf('a');

    assert.equal(calls, 1);
  });
});
