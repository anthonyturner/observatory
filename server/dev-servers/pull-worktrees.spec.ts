import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import {
  NOT_A_PULL_FOLDER,
  type PullPrepareRequest,
  PullWorktrees,
  isPullFolder,
  pullFolder,
} from './pull-worktrees.ts';
import type { ToolCall, ToolOptions, ToolResult } from './tool-runner.ts';
import type { FolderEntry } from './worktree-files.ts';

const CLONE = join('E:', 'repos', 'app');
const WORKTREES = join(CLONE, '.claude', 'worktrees');
const FOLDER = join(WORKTREES, 'observatory-pr-12');
const SHA = '0123456789abcdef0123456789abcdef01234567';
const EXCLUDE = join(CLONE, '.git', 'info', 'exclude');
const REF = 'refs/observatory/pull/12';

const adminOf = (pull: number): string =>
  join(CLONE, '.git', 'worktrees', `observatory-pr-${pull}`);
const folderOf = (pull: number): string => join(WORKTREES, `observatory-pr-${pull}`);
const MARKER = join(adminOf(12), 'observatory-preview');

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
  if (args.includes('rev-parse --verify')) return done(`${SHA}\n`);
  return done();
}

interface Setting {
  /** Overrides what a command answers; return undefined to let it answer as usual. */
  readonly respond?: (call: ToolCall) => ToolResult | undefined;
  /** Held up before a command answers, so jobs can be seen to overlap or not. */
  readonly before?: (call: ToolCall) => Promise<void>;
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
  /** Files that `git worktree add` brings, by path, with their text. */
  readonly afterAdd?: Readonly<Record<string, string>>;
  /** `git worktree add` leaves no `.git` file behind. */
  readonly leavesNoGitFile?: boolean;
}

const file = (name: string): FolderEntry => ({ name, isFile: true, isFolder: false });
const folder = (name: string): FolderEntry => ({ name, isFile: false, isFolder: true });
const link = (name: string): FolderEntry => ({ name, isFile: false, isFolder: false });

/** The files of a worktree this module made for `pull`: git's pointer to its folder, and the marker. */
function made(pull: number): Record<string, string> {
  return {
    [join(folderOf(pull), '.git')]: `gitdir: ${adminOf(pull).replaceAll('\\', '/')}`,
    [join(adminOf(pull), 'observatory-preview')]: `pull ${pull}\n`,
  };
}

/** The same, with its dependencies installed. */
function installed(pull: number): Record<string, string> {
  const root = folderOf(pull);
  return {
    ...made(pull),
    [join(root, 'package.json')]: '{}',
    [join(root, 'package-lock.json')]: '{}',
    [join(root, 'node_modules', '.package-lock.json')]: '{}',
  };
}

function setUp(setting: Setting = {}) {
  const log: string[] = [];
  const calls: ToolCall[] = [];
  const options: { call: ToolCall; options: ToolOptions }[] = [];
  const written = new Map(Object.entries(setting.files ?? {}));
  const existing = new Set([...written.keys(), ...(setting.folders ?? [])]);
  for (const path of written.keys()) {
    for (let up = dirname(path); !existing.has(up) && up !== dirname(up); up = dirname(up)) {
      existing.add(up);
    }
  }
  const phases: string[] = [];
  const worktrees = new PullWorktrees({
    tools: {
      run: async (call, given) => {
        calls.push(call);
        options.push({ call, options: given });
        log.push(call.tool === 'git' ? `git ${call.args.join(' ')}` : `npm ${call.command}`);
        await setting.before?.(call);
        const result = setting.respond?.(call) ?? answer(call);
        if (call.tool === 'git' && call.args.includes('add') && result.code === 0) {
          const added = call.args[call.args.indexOf('--detach') + 1] ?? '';
          existing.add(added);
          for (const [path, text] of Object.entries(setting.afterAdd ?? {})) {
            written.set(path, text);
            existing.add(path);
          }
          if (!setting.leavesNoGitFile) {
            written.set(join(added, '.git'), `gitdir: ${adminOf(12).replaceAll('\\', '/')}`);
            existing.add(join(added, '.git'));
          }
        }
        log.push(`done ${log.at(-1)}`);
        return result;
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
        for (const each of [...written.keys()]) if (each.startsWith(path)) written.delete(each);
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
  const request = (overrides: Partial<PullPrepareRequest> = {}): PullPrepareRequest => ({
    repo: 'me/app',
    clone: CLONE,
    pull: 12,
    isInUse: () => false,
    signal: new AbortController().signal,
    onPhase: (phase) => phases.push(phase),
    ...overrides,
  });
  /** The commands and disk changes, without the bookkeeping lines. */
  const steps = (): string[] => log.filter((line) => !line.startsWith('done '));
  return { worktrees, request, log, steps, calls, options, written, existing, phases };
}

describe('PullWorktrees.prepare', () => {
  it('fetches the head into a private ref, adds a detached worktree at it, marks it as ours, and installs from the lockfile, in that order', async () => {
    const { worktrees, request, steps, phases } = setUp({
      afterAdd: { [join(FOLDER, 'package.json')]: '{}', [join(FOLDER, 'package-lock.json')]: '{}' },
    });

    const prepared = await worktrees.prepare(request());

    assert.deepEqual(prepared, { folder: FOLDER });
    assert.deepEqual(steps(), [
      `git -C ${CLONE} rev-parse --git-common-dir`,
      `append ${EXCLUDE}`,
      `git -C ${CLONE} fetch --no-write-fetch-head origin +refs/pull/12/head:${REF}`,
      `git -C ${CLONE} rev-parse --verify ${REF}^{commit}`,
      `git -C ${CLONE} worktree add --detach ${FOLDER} ${SHA}`,
      `append ${MARKER}`,
      'npm ci',
    ]);
    assert.deepEqual(phases, ['fetching', 'installing']);
  });

  it('never writes FETCH_HEAD, which a fetch of the owner’s would overwrite', async () => {
    const { worktrees, request, log } = setUp();

    await worktrees.prepare(request());

    assert.ok(
      !log.some((line) => line.includes('FETCH_HEAD') && !line.includes('--no-write-fetch-head')),
    );
  });

  it('runs npm in the worktree, and npm install when the project has no lockfile', async () => {
    const { worktrees, request, calls } = setUp({
      afterAdd: { [join(FOLDER, 'package.json')]: '{}' },
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

  it('works for a pull request from a fork, which only the pull head ref reaches, without making a branch', async () => {
    const { worktrees, request, log } = setUp();

    await worktrees.prepare(request({ pull: 9 }));

    assert.ok(
      log.some((line) =>
        line.includes(
          'fetch --no-write-fetch-head origin +refs/pull/9/head:refs/observatory/pull/9',
        ),
      ),
    );
    assert.ok(log.some((line) => line.includes('--detach')));
    assert.ok(!log.some((line) => /\s(-b|-B|branch)\s/.test(line)));
  });

  it('refreshes a worktree it made, without installing again when the dependencies are the same', async () => {
    const { worktrees, request, steps, phases } = setUp({ files: installed(12) });

    const prepared = await worktrees.prepare(request());

    assert.deepEqual(prepared, { folder: FOLDER });
    assert.deepEqual(
      steps().filter((line) => line.includes(FOLDER)),
      [
        `git -C ${FOLDER} status --porcelain`,
        `git -C ${FOLDER} diff --quiet HEAD ${SHA} -- package.json package-lock.json`,
        `git -C ${FOLDER} checkout --detach --force ${SHA}`,
      ],
    );
    assert.ok(!steps().some((line) => line.includes('worktree add') || line === 'npm ci'));
    assert.deepEqual(phases, ['fetching']);
  });

  it('installs again when the refresh changed the dependencies, or the last install never finished', async () => {
    const changed = setUp({
      files: installed(12),
      respond: (call) =>
        call.tool === 'git' && call.args.includes('diff') ? exits(1, '') : undefined,
    });
    const unfinished = { ...installed(12) };
    delete unfinished[join(FOLDER, 'node_modules', '.package-lock.json')];
    const incomplete = setUp({ files: unfinished });

    await changed.worktrees.prepare(changed.request());
    await incomplete.worktrees.prepare(incomplete.request());

    assert.ok(changed.log.includes('npm ci'));
    assert.deepEqual(changed.phases, ['fetching', 'installing']);
    assert.ok(incomplete.log.includes('npm ci'));
  });

  it('refuses to refresh a worktree the owner changed, and leaves it as it is', async () => {
    const { worktrees, request, log } = setUp({
      files: installed(12),
      respond: (call) =>
        call.tool === 'git' && call.args.includes('--porcelain')
          ? done(' M src/app.ts\n?? notes.txt\n')
          : undefined,
    });

    const prepared = await worktrees.prepare(request());

    assert.ok('why' in prepared);
    assert.match('why' in prepared ? prepared.why : '', /src\/app\.ts, notes\.txt/);
    assert.match('why' in prepared ? prepared.why : '', /Remove the preview/);
    assert.ok(!log.some((line) => line.includes('checkout') || line.startsWith('delete')));
  });

  it('does not count what a preview leaves in its worktree as the owner’s changes', async () => {
    const { worktrees, request, log } = setUp({
      files: installed(12),
      respond: (call) =>
        call.tool === 'git' && call.args.includes('--porcelain')
          ? done('?? node_modules/\n?? .env\n?? .env.local\n M package-lock.json\n')
          : undefined,
    });

    const prepared = await worktrees.prepare(request());

    assert.deepEqual(prepared, { folder: FOLDER });
    assert.ok(log.some((line) => line.includes('checkout --detach --force')));
  });

  it('leaves a folder it did not make untouched, owner’s worktree or not, and says it is in the way', async () => {
    const theirs = {
      [join(FOLDER, '.git')]: `gitdir: ${adminOf(12)}`,
      [join(FOLDER, 'package.json')]: '{}',
    };
    const strangers = [
      setUp({ folders: [FOLDER] }),
      setUp({ files: theirs }),
      setUp({ files: { ...theirs, [MARKER]: 'pull 99\n' } }),
    ];

    for (const { worktrees, request, steps } of strangers) {
      const prepared = await worktrees.prepare(request());

      assert.ok('why' in prepared);
      assert.match('why' in prepared ? prepared.why : '', /in the way.*left untouched/);
      assert.ok(
        !steps().some(
          (line) =>
            line.startsWith('delete') ||
            line.includes('checkout') ||
            line.includes('worktree add') ||
            line.startsWith('npm'),
        ),
      );
    }
  });

  it('takes a folder named like the owner’s own pr-<n> worktrees as none of its business', async () => {
    const owners = join(WORKTREES, 'pr-12');
    const { worktrees, request, steps } = setUp({
      files: { [join(owners, '.git')]: 'gitdir: x' },
      folders: [owners],
    });

    const prepared = await worktrees.prepare(request());

    assert.deepEqual(prepared, { folder: FOLDER });
    assert.ok(!steps().some((line) => line.includes(owners)));
  });

  it('cleans up after a worktree that git could not add, and says why', async () => {
    const { worktrees, request, steps } = setUp({
      respond: (call) =>
        call.tool === 'git' && call.args.includes('add')
          ? exits(128, 'fatal: invalid reference')
          : undefined,
    });

    const prepared = await worktrees.prepare(request());

    assert.deepEqual(prepared, {
      why: 'Checking out pull request 12 exited with code 128. Its last output: "fatal: invalid reference"',
    });
    assert.equal(steps().at(-1), `git -C ${CLONE} worktree prune`);
  });

  it('deletes a worktree it could not mark as its own, since it made that folder a moment ago', async () => {
    const { worktrees, request, steps } = setUp({ leavesNoGitFile: true });

    const prepared = await worktrees.prepare(request());

    assert.ok('why' in prepared);
    assert.deepEqual(steps().slice(-3), [
      `git -C ${CLONE} worktree add --detach ${FOLDER} ${SHA}`,
      `delete ${FOLDER}`,
      `git -C ${CLONE} worktree prune`,
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
          ? exits(128, "fatal: couldn't find remote ref refs/pull/12/head")
          : undefined,
    });

    const prepared = await worktrees.prepare(request());

    assert.deepEqual(prepared, {
      why: `Fetching pull request 12 exited with code 128. Its last output: "fatal: couldn't find remote ref refs/pull/12/head"`,
    });
    assert.ok(!log.some((line) => line.includes('worktree add')));
  });

  it('says the install failed, with its last output line', async () => {
    const { worktrees, request } = setUp({
      afterAdd: { [join(FOLDER, 'package.json')]: '{}', [join(FOLDER, 'package-lock.json')]: '{}' },
      respond: (call) => (call.tool === 'npm' ? exits(1, 'npm error 404 Not Found') : undefined),
    });

    const prepared = await worktrees.prepare(request());

    assert.deepEqual(prepared, {
      why: 'Installing the dependencies of pull request 12 (npm ci) exited with code 1. Its last output: "npm error 404 Not Found"',
    });
  });

  it('says an install that ran past its limit was stopped, and one that was ended was ended', async () => {
    const afterAdd = { [join(FOLDER, 'package.json')]: '{}' };
    const slow = setUp({
      afterAdd,
      respond: (call) => (call.tool === 'npm' ? timedOut : undefined),
    });
    const ended = setUp({
      afterAdd,
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
      afterAdd: { [join(FOLDER, 'package.json')]: '{}' },
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
      afterAdd: { [join(FOLDER, 'package.json')]: '{}' },
      respond: (call) => {
        if (call.tool === 'git' && call.args.includes('add')) stop.abort();
        return undefined;
      },
    });

    const prepared = await worktrees.prepare(request({ signal: stop.signal }));

    assert.deepEqual(prepared, { why: 'The preview was stopped.' });
    assert.ok(calls.every((call) => call.tool === 'git'));
  });

  it('refuses to pass git a head that is not a commit hash', async () => {
    const { worktrees, request, log } = setUp({
      respond: (call) =>
        call.tool === 'git' && call.args.includes('--verify')
          ? done('--upload-pack=calc')
          : undefined,
    });

    const prepared = await worktrees.prepare(request());

    assert.ok('why' in prepared);
    assert.ok(!log.some((line) => line.includes('worktree add') || line.includes('checkout')));
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
      folder('observatory-pr-3'),
      folder('observatory-pr-4'),
      folder('observatory-pr-5'),
      folder('observatory-pr-6'),
      folder('observatory-pr-7'),
      folder('observatory-pr-12'),
      folder('pr-3'),
      folder('observatory-pr-8x'),
      folder('notes'),
      folder('observatory-pr-0'),
      file('observatory-pr-8'),
      link('observatory-pr-9'),
    ],
  };
  const files = { ...made(3), ...made(4), ...made(5), ...made(6) };

  it('removes the worktree it made for a closed pull request when a preview starts, and keeps the rest', async () => {
    const { worktrees, request, log } = setUp({ listing, files, open: [4, 12], unreadable: [6] });

    await worktrees.prepare(request({ isInUse: (pull) => pull === 5 }));

    assert.deepEqual(
      log.filter((line) => line.startsWith('state')),
      ['state 3', 'state 4', 'state 6'],
    );
    assert.deepEqual(
      log.filter((line) => line.startsWith('delete')),
      [`delete ${folderOf(3)}`],
    );
  });

  it('leaves a folder it did not make alone, however closed its pull request', async () => {
    const { worktrees, request, log } = setUp({ listing, files: { ...made(3) } });

    await worktrees.prepare(request());

    assert.ok(
      !log.some((line) => line.includes(folderOf(7)) || line.includes(join(WORKTREES, 'pr-3'))),
    );
    assert.ok(!log.includes('state 7'));
  });

  it('asks again whether a worktree is in use just before it removes it', async () => {
    let asked = 0;
    const { worktrees, request, log } = setUp({ listing, files });

    await worktrees.prepare(request({ isInUse: (pull) => pull === 3 && ++asked > 1 }));

    assert.equal(asked, 2);
    assert.ok(!log.includes(`delete ${folderOf(3)}`));
  });

  it('prunes before it fetches, so a closed pull request’s files are gone first', async () => {
    const { worktrees, request, steps } = setUp({ listing, files });

    await worktrees.prepare(request());

    const removal = steps().findIndex((line) => line.startsWith('delete'));
    const fetch = steps().findIndex((line) => line.includes('fetch '));
    assert.ok(removal >= 0 && removal < fetch);
  });
});

describe('PullWorktrees.remove', () => {
  it('deletes a worktree it made itself, then drops git’s record and the private ref, and never asks git to remove it', async () => {
    const { worktrees, steps } = setUp({ files: installed(12) });

    const problem = await worktrees.remove(CLONE, 12);

    assert.equal(problem, null);
    assert.deepEqual(steps(), [
      `delete ${FOLDER}`,
      `git -C ${CLONE} worktree prune`,
      `git -C ${CLONE} update-ref -d ${REF}`,
    ]);
  });

  it('succeeds for a worktree that is already gone, and still drops the record and the ref', async () => {
    const { worktrees, steps } = setUp();

    assert.equal(await worktrees.remove(CLONE, 12), null);
    assert.deepEqual(steps(), [
      `git -C ${CLONE} worktree prune`,
      `git -C ${CLONE} update-ref -d ${REF}`,
    ]);
  });

  it('leaves a folder it did not make alone, and says so', async () => {
    const { worktrees, steps } = setUp({ folders: [FOLDER] });

    const problem = await worktrees.remove(CLONE, 12);

    assert.match(problem ?? '', /in the way.*left untouched/);
    assert.deepEqual(steps(), []);
  });

  it('says so when the folder cannot be deleted, and does not report it removed', async () => {
    const { worktrees, steps } = setUp({
      files: installed(12),
      removeFails: 'EBUSY: resource busy or locked',
    });

    const problem = await worktrees.remove(CLONE, 12);

    assert.equal(
      problem,
      'The worktree of pull request 12 could not be removed: EBUSY: resource busy or locked',
    );
    assert.ok(!steps().some((line) => line.includes('update-ref')));
  });

  it('says so when git cannot drop its record or the ref', async () => {
    const pruneFails = setUp({
      respond: (call) =>
        call.tool === 'git' && call.args.includes('prune') ? exits(1, 'locked') : undefined,
    });
    const refFails = setUp({
      respond: (call) =>
        call.tool === 'git' && call.args.includes('update-ref')
          ? exits(1, 'cannot lock ref')
          : undefined,
    });

    assert.match(
      (await pruneFails.worktrees.remove(CLONE, 12)) ?? '',
      /Pruning.*exited with code 1/,
    );
    assert.match(
      (await refFails.worktrees.remove(CLONE, 12)) ?? '',
      /private ref.*cannot lock ref/,
    );
  });

  it('refuses a number that is not a pull request’s, and removes nothing', async () => {
    const { worktrees, log } = setUp();

    for (const pull of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(await worktrees.remove(CLONE, pull), NOT_A_PULL_FOLDER);
    }
    assert.deepEqual(log, []);
  });

  it('runs the removals and the preparation of one worktree one at a time, in the order asked', async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { worktrees, request, steps } = setUp({
      files: installed(12),
      before: async (call) => {
        if (call.tool === 'git' && call.args.includes('prune')) await gate;
      },
    });

    const removing = worktrees.remove(CLONE, 12);
    const again = worktrees.remove(CLONE, 12);
    const preparing = worktrees.prepare(request());
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(steps().filter((line) => line.includes('update-ref')).length, 0);
    release();
    await Promise.all([removing, again, preparing]);

    const order = steps().filter(
      (line) =>
        line.includes('update-ref') || line.includes('worktree add') || line.includes('fetch '),
    );
    assert.deepEqual(
      order.map((line) =>
        line.includes('update-ref') ? 'ref' : line.includes('fetch') ? 'fetch' : 'add',
      ),
      ['ref', 'ref', 'fetch', 'add'],
    );
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
    assert.equal(isPullFolder(CLONE, join(FOLDER, '..', 'observatory-pr-7')), true);
  });

  it('refuses everything else', () => {
    const refused = [
      CLONE,
      join(CLONE, '.claude'),
      WORKTREES,
      join(FOLDER, 'node_modules'),
      join(FOLDER, '..', '..'),
      join(WORKTREES, 'observatory-pr-'),
      join(WORKTREES, 'observatory-pr-0'),
      join(WORKTREES, 'observatory-pr-012'),
      join(WORKTREES, 'observatory-pr-12x'),
      join(WORKTREES, 'pr-12'),
      join(WORKTREES, '595-pr-preview'),
      join(WORKTREES, 'xobservatory-pr-12'),
      join(CLONE, '..', 'other', '.claude', 'worktrees', 'observatory-pr-12'),
      join(CLONE, 'observatory-pr-12'),
      join('E:', 'repos', 'app2', '.claude', 'worktrees', 'observatory-pr-12'),
      join(FOLDER, '..'),
    ];
    for (const path of refused) assert.equal(isPullFolder(CLONE, path), false, path);
  });

  it('has no folder for a number that is not a pull request’s', () => {
    for (const pull of [0, -4, 2.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) {
      assert.equal(pullFolder(CLONE, pull), null, String(pull));
    }
  });
});
