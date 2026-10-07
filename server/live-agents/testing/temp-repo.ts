import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Git, GitOutput } from '../read-only-git.ts';

/** git as a test sets a repository up with: it may write, unlike the code under test. */
export const git = (dir: string, ...args: string[]): string =>
  execFileSync(
    'git',
    [
      '-C',
      dir,
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@t',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'core.autocrlf=false',
      ...args,
    ],
    { encoding: 'utf8' },
  );

export const tempDir = (name: string): string =>
  mkdtempSync(join(tmpdir(), `observatory-${name}-`));

export function write(dir: string, path: string, content: string | Buffer): void {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), content);
}

export function commitAll(dir: string, message: string): void {
  git(dir, 'add', '-A');
  git(dir, 'commit', '--quiet', '-m', message);
}

/** An "origin" whose `branch` holds one committed file, `base.txt`. */
export function origin(branch = 'main'): string {
  const dir = tempDir('origin');
  git(dir, 'init', '--quiet', `--initial-branch=${branch}`);
  write(dir, 'base.txt', 'base\n');
  commitAll(dir, 'base');
  return dir;
}

/** A clone of `from`, so it has `origin/HEAD` and the remote's branches. */
export function cloneOf(from: string): string {
  const dir = join(tempDir('clone'), 'clone');
  execFileSync('git', ['clone', '--quiet', from, dir]);
  return dir;
}

/** `inner`, with every call it is asked to make kept for a test to look at. */
export function recording(inner: Git): { git: Git; calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    git: (dir, args): Promise<GitOutput> => {
      calls.push([...args]);
      return inner(dir, args);
    },
  };
}
