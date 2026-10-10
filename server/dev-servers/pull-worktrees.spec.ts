import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  NOT_A_PULL_FOLDER,
  type PrepareRequest,
  PullWorktrees,
  isPullFolder,
  pullFolder,
} from './pull-worktrees.ts';
import type { ToolCall, ToolOptions, ToolResult } from './tool-runner.ts';
import type { FolderEntry } from './worktree-files.ts';

const CLONE = join('E:', 'repos', 'app');
const WORKTREES = join(CLONE, '.claude', 'worktrees');
const FOLDER = join(WORKTREES, 'pr-12');
const SHA = '0123456789abcdef0123456789abcdef01234567';
const EXCLUDE = join(CLONE, '.git', 'info', 'exclude');

const done = (stdout = ''): ToolResult => ({ code: 0, stdout, lastLine: '', hasTimedOut: false });
const exits = (code: number | null, lastLine: string): ToolResult => ({
  code,
  stdout: '',
  lastLine,
  hasTimedOut: false,
});
const timedOut: ToolResult = { code: null, stdout: '', lastLine: 'still going', hasTimedOut: true };

/** What git prints for the commands that answer with something. */
function answer(call: ToolCall): ToolResult {
  if (call.tool === 'npm') return done();
  const args = call.args.join(' ');
  if (args.includes('--git-common-dir')) return done('.git\n');
  if (args.includes('rev-parse --verify FETCH_HEAD')) return done(`${SHA}\n`);
  return done();
}

interface Setting {
  /** Overrides what a command answers; return undefined to let it answer as usual. */
  readonly respond?: (call: ToolCall) => ToolResult | undefined;
  /** Files that exist, by path, with their text. */
  readonly files?: Readonly<Record<string, string>>;
  /** Folders that exist. */
  readonly folders?: readonly string[];
  /** What a listed folder holds. */
  readonly listing?: Readonly<Record<string, readonly FolderEntry[]>>;
  /** Pull requests that are open; any other is closed. */
  readonly open?: readonly number[];
  /** Pull requests whose state cannot be read. */
  readonly unreadable?: readonly number[];
  readonly removeFails?: string;
}

const file = (name: string): FolderEntry => ({ name, isFile: true, isFolder: false });
const folder = (name: string): FolderEntry => ({ name, isFile: false, isFolder: true });
const link = (name: string): FolderEntry => ({ name, isFile: false, isFolder: false });

function setUp(setting: Setting = {}) {
  const log: string[] = [];
  const calls: ToolCall[] = [];
  const options: { call: ToolCall; options: ToolOptions }[] = [];
  const written = new Map(Object.entries(setting.files ?? {}));
  const existing = new Set([...written.keys(), ...(setting.folders ?? [])]);
  const phases: string[] = [];
  const worktrees = new PullWorktrees({
    tools: {
      run: async (call, given) => {
        calls.push(call);
        options.push({ call, options: given });
        log.push(call.tool === 'git' ? `git ${call.args.join(' ')}` : `npm ${call.command}`);
        return setting.respond?.(call) ?? answer(call);
      },
      shutdown: () => void log.push('shutdown'),
    },
    files: {
      read: async (path) => written.get(path) ?? null,
      append: async (path, text) => {
        written.set(path, (written.get(path) ?? '') + text);
        existing.add(path);
        log.push(`append ${path}`);
      },
      exists: async (path) => existing.has(path),
      list: async (path) => setting.listing?.[path] ?? [],
      copy: async (from, to) => void log.push(`copy ${from} -> ${to}`),
      removeTree: async (path) => {
        log.push(`delete ${path}`);
        if (setting.removeFails) throw new Error(setting.removeFails);
        existing.delete(path);
      },
    },
    pulls: {
      isOpen: async (_repo, pull) => {
        log.push(`state ${pull}`);
        if (setting.unreadable?.includes(pull)) throw new Error('GitHub could not be read');
        return setting.open?.includes(pull) ?? false;
      },
    },
  });
  const request = (overrides: Partial<PrepareRequest> = {}): PrepareRequest => ({
    repo: 'me/app',
    clone: CLONE,
    pull: 12,
    inUse: [],
    signal: new AbortController().signal,
    onPhase: (phase) => phases.push(phase),
    ...overrides,
  });
  return { worktrees, request, log, calls, options, written, existing, phases };
}

const installed = (folderPath: string): Record<string, string> => ({
  [join(folderPath, '.git')]: 'gitdir: x',
  [join(folderPath, 'package.json')]: '{}',
  [join(folderPath, 'package-lock.json')]: '{}',
  [join(folderPath, 'node_modules', '.package-lock.json')]: '{}',
});

describe('PullWorktrees.prepare', () => {
  it('fetches the head, adds a detached worktree at it, and installs from the lockfile, in that order', async () => {
    const { worktrees, request, log, phases } = setUp({
      files: { [join(FOLDER, 'package.json')]: '{}', [join(FOLDER, 'package-lock.json')]: '{}' },
    });

    const prepared = await worktrees.prepare(request());

    assert.deepEqual(prepared, { folder: FOLDER });
    assert.deepEqual(log, [
      `git -C ${CLONE} rev-parse --git-common-dir`,
      `append ${EXCLUDE}`,
      `git -C ${CLONE} fetch origin pull/12/head`,
      `git -C ${CLONE} rev-parse --verify FETCH_HEAD`,
      `git -C ${CLONE} worktree add --detach ${FOLDER} ${SHA}`,
      'npm ci',
    ]);
    assert.deepEqual(phases, ['fetching', 'installing']);
  });

  it('runs npm in the worktree, and npm install when the project has no lockfile', async () => {
    const { worktrees, request, calls } = setUp({
      files: { [join(FOLDER, 'package.json')]: '{}' },
    });

    await worktrees.prepare(request());

    assert.deepEqual(calls.at(-1), { tool: 'npm', cwd: FOLDER, command: 'install' });
  });

  it('installs nothing for a project with no package.json', async () => {
    const { worktrees, request, calls, phases } = setUp();

    const prepared = await worktrees.prepare(request());

    assert.deepEqual(prepared, { folder: FOLDER });
    assert.ok(calls.every((call) => call.tool === 'git'));
    assert.deepEqual(phases, ['fetching']);
  });

  it('keeps the worktrees out of the clone’s git status, once', async () => {
    const first = setUp();
    await first.worktrees.prepare(first.request());
    const again = setUp({ files: { [EXCLUDE]: '*.log\n.claude/worktrees/\n' } });
    await again.worktrees.prepare(again.request());
    const slashed = setUp({ files: { [EXCLUDE]: '/.claude/worktrees\r\n' } });
    await slashed.worktrees.prepare(slashed.request());
    const unfinished = setUp({ files: { [EXCLUDE]: '*.log' } });
    await unfinished.worktrees.prepare(unfinished.request());

    assert.equal(first.written.get(EXCLUDE), '.claude/worktrees/\n');
    assert.equal(again.written.get(EXCLUDE), '*.log\n.claude/worktrees/\n');
    assert.equal(slashed.written.get(EXCLUDE), '/.claude/worktrees\r\n');
    assert.equal(unfinished.written.get(EXCLUDE), '*.log\n.claude/worktrees/\n');
  });

  it('finds the exclude file of a clone whose git folder is elsewhere', async () => {
    const elsewhere = join('E:', 'repos', 'main-checkout', '.git');
    const { worktrees, request, written } = setUp({
      respond: (call) =>
        call.tool === 'git' && call.args.includes('--git-common-dir')
          ? done(`${elsewhere}\n`)
          : undefined,
    });

    await worktrees.prepare(request());

    assert.ok(written.has(join(elsewhere, 'info', 'exclude')));
  });

  it('works for a pull request from a fork, which only the pull head ref reaches', async () => {
    const { worktrees, request, log } = setUp();

    await worktrees.prepare(request({ pull: 9 }));

    assert.ok(log.includes(`git -C ${CLONE} fetch origin pull/9/head`));
    assert.ok(log.some((line) => line.includes('--detach')));
    assert.ok(!log.some((line) => /\b(-b|-B|branch)\b/.test(line)));
  });

  it('refreshes a worktree a past preview left, without installing again when the dependencies are the same', async () => {
    const { worktrees, request, log, phases } = setUp({ files: installed(FOLDER) });

    const prepared = await worktrees.prepare(request());

    assert.deepEqual(prepared, { folder: FOLDER });
    assert.ok(!log.some((line) => line.includes('worktree add')));
    assert.deepEqual(
      log.filter((line) => line.includes(FOLDER)),
      [
        `git -C ${FOLDER} diff --quiet HEAD ${SHA} -- package.json package-lock.json`,
        `git -C ${FOLDER} checkout --detach --force ${SHA}`,
      ],
    );
    assert.ok(!log.includes('npm ci'));
    assert.deepEqual(phases, ['fetching']);
  });

  it('installs again when the refresh changed the dependencies', async () => {
    const { worktrees, request, log, phases } = setUp({
      files: installed(FOLDER),
      respond: (call) =>
        call.tool === 'git' && call.args.includes('diff') ? exits(1, '') : undefined,
    });

    await worktrees.prepare(request());

    assert.ok(log.includes('npm ci'));
    assert.deepEqual(phases, ['fetching', 'installing']);
  });

  it('installs again when the last install never finished', async () => {
    const files = installed(FOLDER);
    delete files[join(FOLDER, 'node_modules', '.package-lock.json')];
    const { worktrees, request, log } = setUp({ files });

    await worktrees.prepare(request());

    assert.ok(log.includes('npm ci'));
  });

  it('clears a folder git has no record of before adding the worktree there', async () => {
    const { worktrees, request, log } = setUp({ folders: [FOLDER] });

    await worktrees.prepare(request());

    const steps = log.filter((line) => /delete|prune|worktree add/.test(line));
    assert.deepEqual(steps, [
      `delete ${FOLDER}`,
      `git -C ${CLONE} worktree prune`,
      `git -C ${CLONE} worktree add --detach ${FOLDER} ${SHA}`,
    ]);
  });

  it('copies the clone’s .env files, and only files, into the worktree', async () => {
    const { worktrees, request, log } = setUp({
      listing: {
        [CLONE]: [
          file('.env'),
          file('.env.local'),
          file('.env.development.local'),
          folder('.env'),
          file('.envrc'),
          file('.environment'),
          file('package.json'),
          link('.env.link'),
        ],
      },
    });

    await worktrees.prepare(request());

    assert.deepEqual(
      log.filter((line) => line.startsWith('copy')),
      [
        `copy ${join(CLONE, '.env')} -> ${join(FOLDER, '.env')}`,
        `copy ${join(CLONE, '.env.local')} -> ${join(FOLDER, '.env.local')}`,
        `copy ${join(CLONE, '.env.development.local')} -> ${join(FOLDER, '.env.development.local')}`,
      ],
    );
  });

  it('says the fetch failed, with its last line, and goes no further', async () => {
    const { worktrees, request, log } = setUp({
      respond: (call) =>
        call.tool === 'git' && call.args.includes('fetch')
          ? exits(128, "fatal: couldn't find remote ref pull/12/head")
          : undefined,
    });

    const prepared = await worktrees.prepare(request());

    assert.deepEqual(prepared, {
      why: `Fetching pull request 12 exited with code 128. Its last output: "fatal: couldn't find remote ref pull/12/head"`,
    });
    assert.ok(!log.some((line) => line.includes('worktree add')));
  });

  it('refuses to pass git a head that is not a commit hash', async () => {
    const { worktrees, request, log } = setUp({
      respond: (call) =>
        call.tool === 'git' && call.args.includes('FETCH_HEAD')
          ? done('--upload-pack=calc')
          : undefined,
    });

    const prepared = await worktrees.prepare(request());

    assert.ok('why' in prepared);
    assert.ok(!log.some((line) => line.includes('worktree add') || line.includes('checkout')));
  });

  it('says the install failed, with its last output line', async () => {
    const { worktrees, request } = setUp({
      files: { [join(FOLDER, 'package.json')]: '{}', [join(FOLDER, 'package-lock.json')]: '{}' },
      respond: (call) => (call.tool === 'npm' ? exits(1, 'npm error 404 Not Found') : undefined),
    });

    const prepared = await worktrees.prepare(request());

    assert.deepEqual(prepared, {
      why: 'Installing the dependencies of pull request 12 (npm ci) exited with code 1. Its last output: "npm error 404 Not Found"',
    });
  });

  it('says an install that ran past its limit was stopped, and one that was ended was ended', async () => {
    const files = { [join(FOLDER, 'package.json')]: '{}' };
    const slow = setUp({ files, respond: (call) => (call.tool === 'npm' ? timedOut : undefined) });
    const ended = setUp({
      files,
      respond: (call) => (call.tool === 'npm' ? exits(null, '') : undefined),
    });

    const late = await slow.worktrees.prepare(slow.request());
    const cut = await ended.worktrees.prepare(ended.request());

    assert.deepEqual(late, {
      why: 'Installing the dependencies of pull request 12 (npm install) did not finish within 10 minutes, so it was stopped. Its last output: "still going"',
    });
    assert.deepEqual(cut, {
      why: 'Installing the dependencies of pull request 12 (npm install) was ended.',
    });
  });

  it('gives the fetch and the install the signal that stops them, and each its own time limit', async () => {
    const stop = new AbortController();
    const { worktrees, request, options } = setUp({
      files: { [join(FOLDER, 'package.json')]: '{}' },
    });

    await worktrees.prepare(request({ signal: stop.signal }));

    const fetch = options.find(({ call }) => call.tool === 'git' && call.args.includes('fetch'));
    const install = options.find(({ call }) => call.tool === 'npm');
    assert.equal(fetch?.options.signal, stop.signal);
    assert.equal(install?.options.signal, stop.signal);
    assert.equal(fetch?.options.limitMs, 2 * 60_000);
    assert.equal(install?.options.limitMs, 10 * 60_000);
  });

  it('does not install into a worktree whose preview was stopped meanwhile', async () => {
    const stop = new AbortController();
    const { worktrees, request, calls } = setUp({
      files: { [join(FOLDER, 'package.json')]: '{}' },
      respond: (call) => {
        if (call.tool === 'git' && call.args.includes('worktree')) stop.abort();
        return undefined;
      },
    });

    const prepared = await worktrees.prepare(request({ signal: stop.signal }));

    assert.deepEqual(prepared, { why: 'The preview was stopped.' });
    assert.ok(calls.every((call) => call.tool === 'git'));
  });

  it('refuses a number that is not a pull request’s, and runs nothing', async () => {
    const { worktrees, request, log } = setUp();

    for (const pull of [0, -1, 1.5, Number.NaN, 2 ** 60]) {
      const prepared = await worktrees.prepare(request({ pull }));
      assert.ok('why' in prepared);
    }
    assert.deepEqual(log, []);
  });

  it('turns an error from the disk into a reason', async () => {
    const { worktrees, request } = setUp({
      respond: () => {
        throw new Error('EPERM: operation not permitted');
      },
    });

    const prepared = await worktrees.prepare(request());

    assert.deepEqual(prepared, {
      why: 'Could not set up the worktree: EPERM: operation not permitted',
    });
  });
});

describe('PullWorktrees pruning', () => {
  const listing = {
    [WORKTREES]: [
      folder('pr-3'),
      folder('pr-4'),
      folder('pr-5'),
      folder('pr-6'),
      folder('pr-12'),
      folder('pr-7x'),
      folder('notes'),
      folder('pr-0'),
      file('pr-8'),
      link('pr-9'),
    ],
  };

  it('removes the worktree of a closed pull request when a preview starts, and keeps the rest', async () => {
    const { worktrees, request, log } = setUp({
      listing,
      open: [4, 12],
      unreadable: [6],
    });

    await worktrees.prepare(request({ inUse: [5] }));

    assert.deepEqual(
      log.filter((line) => line.startsWith('state')),
      ['state 3', 'state 4', 'state 6'],
    );
    const removed = log.filter((line) => line.includes('worktree remove'));
    assert.equal(removed.length, 1);
    assert.ok(removed[0]?.endsWith(join(WORKTREES, 'pr-3')));
  });

  it('prunes before it fetches, so a closed pull request’s files are gone first', async () => {
    const { worktrees, request, log } = setUp({ listing });

    await worktrees.prepare(request());

    const removal = log.findIndex((line) => line.includes('worktree remove'));
    const fetch = log.findIndex((line) => line.includes('fetch origin'));
    assert.ok(removal >= 0 && removal < fetch);
  });
});

describe('PullWorktrees.remove', () => {
  it('removes the worktree with git, long paths allowed, and deletes nothing itself', async () => {
    const { worktrees, log } = setUp();

    const problem = await worktrees.remove(CLONE, 12);

    assert.equal(problem, null);
    assert.deepEqual(log, [
      `git -c core.longpaths=true -C ${CLONE} worktree remove --force ${FOLDER}`,
    ]);
  });

  it('deletes the folder itself when git cannot, then prunes git’s record of it', async () => {
    const { worktrees, log } = setUp({
      respond: (call) =>
        call.tool === 'git' && call.args.includes('remove')
          ? exits(1, 'error: Filename too long')
          : undefined,
    });

    const problem = await worktrees.remove(CLONE, 12);

    assert.equal(problem, null);
    assert.deepEqual(log.slice(1), [`delete ${FOLDER}`, `git -C ${CLONE} worktree prune`]);
  });

  it('succeeds for a worktree that is already gone', async () => {
    const { worktrees } = setUp({
      respond: (call) =>
        call.tool === 'git' && call.args.includes('remove')
          ? exits(128, 'is not a working tree')
          : undefined,
    });

    assert.equal(await worktrees.remove(CLONE, 12), null);
  });

  it('says so when neither git nor the fallback can remove it', async () => {
    const { worktrees } = setUp({
      removeFails: 'EBUSY: resource busy or locked',
      respond: (call) =>
        call.tool === 'git' && call.args.includes('remove') ? exits(1, 'locked') : undefined,
    });

    const problem = await worktrees.remove(CLONE, 12);

    assert.equal(
      problem,
      'The worktree of pull request 12 could not be removed: EBUSY: resource busy or locked',
    );
  });

  it('refuses a number that is not a pull request’s, and removes nothing', async () => {
    const { worktrees, log } = setUp();

    for (const pull of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(await worktrees.remove(CLONE, pull), NOT_A_PULL_FOLDER);
    }
    assert.deepEqual(log, []);
  });

  it('ends what git and npm are doing when asked to shut down', () => {
    const { worktrees, log } = setUp();

    worktrees.shutdown();

    assert.deepEqual(log, ['shutdown']);
  });
});

describe('which folders may be deleted', () => {
  it('names one pull request’s worktree as a folder directly under the clone’s worktrees folder', () => {
    assert.equal(pullFolder(CLONE, 12), FOLDER);
    assert.equal(isPullFolder(CLONE, FOLDER), true);
    assert.equal(isPullFolder(CLONE, join(FOLDER, '..', 'pr-7')), true);
  });

  it('refuses everything else', () => {
    const refused = [
      CLONE,
      join(CLONE, '.claude'),
      WORKTREES,
      join(WORKTREES, 'pr-12', 'node_modules'),
      join(WORKTREES, 'pr-12', '..', '..'),
      join(WORKTREES, 'pr-'),
      join(WORKTREES, 'pr-0'),
      join(WORKTREES, 'pr-012'),
      join(WORKTREES, 'pr-12x'),
      join(WORKTREES, '595-pr-preview'),
      join(WORKTREES, 'xpr-12'),
      join(CLONE, '..', 'other', '.claude', 'worktrees', 'pr-12'),
      join(CLONE, 'pr-12'),
      join('E:', 'repos', 'app2', '.claude', 'worktrees', 'pr-12'),
      join(CLONE, '.claude', 'worktrees', 'pr-12', '..'),
    ];
    for (const path of refused) assert.equal(isPullFolder(CLONE, path), false, path);
  });

  it('has no folder for a number that is not a pull request’s', () => {
    for (const pull of [0, -4, 2.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) {
      assert.equal(pullFolder(CLONE, pull), null, String(pull));
    }
  });
});
