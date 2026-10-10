import { join, relative, resolve } from 'node:path';
import type { StartPhase } from './dev-server-types.ts';
import type { ToolCall, ToolResult, ToolRunner } from './tool-runner.ts';
import type { Prepared } from './workspace.ts';
import type { WorktreeFiles } from './worktree-files.ts';

/** Which pull requests are still open, so a worktree of a closed one can go. */
export interface PullStates {
  isOpen(repo: string, pull: number): Promise<boolean>;
}

/** What a preview of one pull request is asked to set up. */
export interface PullPrepareRequest {
  readonly repo: string;
  /** The project's clone, from the registry. */
  readonly clone: string;
  readonly pull: number;
  /** Whether a server holds another pull request's worktree, which pruning then leaves alone. */
  readonly isInUse: (pull: number) => boolean;
  /** Stopping the preview aborts this, and with it any command in flight. */
  readonly signal: AbortSignal;
  readonly onPhase: (phase: Extract<StartPhase, 'fetching' | 'installing'>) => void;
}

export interface PullWorktreeDependencies {
  readonly tools: ToolRunner;
  readonly files: WorktreeFiles;
  readonly pulls: PullStates;
}

const WORKTREES = ['.claude', 'worktrees'];
/** Prefixed so a folder the owner or an agent made, such as `pr-12`, is never taken for a preview. */
const FOLDER_PREFIX = 'observatory-pr-';
const PULL_FOLDER = /^observatory-pr-[1-9]\d*$/;
const PULL_FOLDER_NAME = /^observatory-pr-([1-9]\d*)$/;
/** Written into git's own record of a worktree this module made, which only this module writes. */
const MARKER_FILE = 'observatory-preview';
const GITDIR_LINE = /^gitdir:\s*(.+?)\s*$/m;
/** Keeps the worktrees out of `git status` in the clone. */
const EXCLUDE_PATTERN = '.claude/worktrees/';
/** A line of an exclude file that already covers the worktrees, with or without its slashes. */
const excludesWorktrees = (line: string): boolean =>
  line.trim().replace(/^\/|\/$/g, '') === '.claude/worktrees';
/** The `.env` files an app reads, which git ignores and so a new worktree lacks. */
const ENV_FILE = /^\.env(\..+)?$/;
/** What a preview itself leaves in its worktree: not the owner's edits, so it never blocks a refresh. */
const MADE_BY_PREVIEW = /^(node_modules(\/|$)|\.env(\..+)?$|package-lock\.json$)/;
const DEPENDENCY_FILES = ['package.json', 'package-lock.json'];
/** npm writes this when an install completes, so a folder with it holds a whole one. */
const INSTALLED_MARKER = join('node_modules', '.package-lock.json');
/** A full commit hash, which cannot be read as an option when it is passed to git. */
const COMMIT_HASH = /^[0-9a-f]{40,64}$/;

const GIT_LIMIT_MS = 2 * 60_000;
/** A cold install of a large project is slow; this is separate from the server's own start limit. */
const INSTALL_LIMIT_MS = 10 * 60_000;
const MS_PER_MINUTE = 60_000;

export const NOT_A_PULL_FOLDER =
  'Refused to remove a folder that is not a pull request’s worktree.';
export const STOPPED_MEANWHILE = 'The preview was stopped.';

/** The folder of the pull request's worktree, or null for a number that is not a pull request's. */
export function pullFolder(clone: string, pull: number): string | null {
  return Number.isSafeInteger(pull) && pull >= 1
    ? join(clone, ...WORKTREES, `${FOLDER_PREFIX}${pull}`)
    : null;
}

/**
 * Whether `folder` is exactly one pull request's worktree folder of `clone`:
 * directly under its worktrees folder, named `observatory-pr-` and a number.
 * The first test a delete has to pass; being marked as made here is the second.
 */
export function isPullFolder(clone: string, folder: string): boolean {
  return PULL_FOLDER.test(relative(join(clone, ...WORKTREES), resolve(folder)));
}

/** The private ref the pull request's head is fetched into, which no fetch of the owner's overwrites. */
const pullRef = (pull: number): string => `refs/observatory/pull/${pull}`;

const markerText = (pull: number): string => `pull ${pull}
`;

const quoted = (line: string): string => `"${line}"`;

const inTheWay = (folder: string): string =>
  `A folder at ${folder} is in the way and was not made by Observatory, so it was left untouched. Move or delete it, then try again.`;

function describeFailure(what: string, result: ToolResult, limitMs: number): string {
  const how = result.hasTimedOut
    ? `did not finish within ${limitMs / MS_PER_MINUTE} minutes, so it was stopped`
    : result.code === null
      ? 'was ended'
      : `exited with code ${result.code}`;
  return `${what} ${how}.${result.lastLine ? ` Its last output: ${quoted(result.lastLine)}` : ''}`;
}

/** What checking out left to do: its dependencies need installing unless the worktree was reused with the same ones. */
type CheckedOut = { readonly needsInstall: boolean } | { readonly why: string };

/**
 * A pull request's head checked out in a folder of its own under the project's
 * clone, ready to run: fetched into a private ref, detached so no branch
 * appears in the user's repository, and with its dependencies installed. Every
 * command is built here from a validated number and the registry's clone,
 * never from request text. The worktrees are marked as made here, and only
 * marked ones are refreshed, pruned or removed. Everything that changes one
 * worktree runs one at a time.
 */
export class PullWorktrees {
  private readonly dependencies: PullWorktreeDependencies;
  /** For the commands nothing stops: a removal always runs to the end. */
  private readonly never = new AbortController().signal;
  /** The last job queued for each worktree. */
  private readonly queues = new Map<string, Promise<void>>();

  constructor(dependencies: PullWorktreeDependencies) {
    this.dependencies = dependencies;
  }

  /** Sets up the worktree, or refreshes the one a past preview left. */
  async prepare(request: PullPrepareRequest): Promise<Prepared> {
    const { clone, pull, onPhase } = request;
    const folder = pullFolder(clone, pull);
    if (!folder) return { why: `${pull} is not a pull request number.` };
    try {
      onPhase('fetching');
      const excluded = await this.excludeWorktrees(clone);
      if (excluded) return { why: excluded };
      await this.pruneClosed(request);
      return await this.inQueue(clone, pull, () => this.setUp(request, folder));
    } catch (error: unknown) {
      return { why: `Could not set up the worktree: ${(error as Error).message}` };
    }
  }

  /**
   * Removes the pull request's worktree and what it holds, or says why it
   * could not. One that is already gone is removed; a folder that was not made
   * here is left untouched.
   */
  remove(clone: string, pull: number): Promise<string | null> {
    const folder = pullFolder(clone, pull);
    if (!folder || !isPullFolder(clone, folder)) return Promise.resolve(NOT_A_PULL_FOLDER);
    return this.inQueue(clone, pull, () => this.removeNow(clone, pull, folder));
  }

  /** Ends any git or npm still running, at once: for the API's exit. */
  shutdown(): void {
    this.dependencies.tools.shutdown();
  }

  /** Runs `job` after every job queued before it for the same worktree has finished. */
  private inQueue<T>(clone: string, pull: number, job: () => Promise<T>): Promise<T> {
    const key = `${clone.toLowerCase()}#${pull}`;
    const run = (this.queues.get(key) ?? Promise.resolve()).then(job);
    const settled = run.then(
      () => undefined,
      () => undefined,
    );
    this.queues.set(key, settled);
    void settled.then(() => {
      if (this.queues.get(key) === settled) this.queues.delete(key);
    });
    return run;
  }

  private git(
    args: readonly string[],
    limitMs: number,
    signal: AbortSignal = this.never,
  ): Promise<ToolResult> {
    return this.dependencies.tools.run({ tool: 'git', args }, { signal, limitMs });
  }

  private async setUp(request: PullPrepareRequest, folder: string): Promise<Prepared> {
    const head = await this.fetchHead(request);
    if ('why' in head) return head;
    const checkedOut = await this.checkOut(request, folder, head.sha);
    if ('why' in checkedOut) return checkedOut;
    await this.copyEnvFiles(request.clone, folder);
    const installed = await this.install(request, folder, checkedOut.needsInstall);
    return installed ? { why: installed } : { folder };
  }

  /** Deletes the worktree, but only one this module made, then drops git's record of it and the private ref. */
  private async removeNow(clone: string, pull: number, folder: string): Promise<string | null> {
    try {
      if (await this.dependencies.files.exists(folder)) {
        if (!(await this.isOwned(folder, pull))) return inTheWay(folder);
        await this.deleteFolder(clone, folder);
      }
      return await this.forget(clone, pull);
    } catch (error: unknown) {
      return `The worktree of pull request ${pull} could not be removed: ${(error as Error).message}`;
    }
  }

  /** Drops git's record of worktrees whose folder is gone, and the pull request's private ref. */
  private async forget(clone: string, pull: number): Promise<string | null> {
    const pruned = await this.git(['-C', clone, 'worktree', 'prune'], GIT_LIMIT_MS);
    if (pruned.code !== 0)
      return describeFailure('Pruning git’s worktree records', pruned, GIT_LIMIT_MS);
    const dropped = await this.git(['-C', clone, 'update-ref', '-d', pullRef(pull)], GIT_LIMIT_MS);
    return dropped.code === 0
      ? null
      : describeFailure('Dropping the pull request’s private ref', dropped, GIT_LIMIT_MS);
  }

  /** The only place a folder is deleted, and only after it proves to be a pull request's worktree. */
  private async deleteFolder(clone: string, folder: string): Promise<void> {
    if (!isPullFolder(clone, folder)) throw new Error(NOT_A_PULL_FOLDER);
    await this.dependencies.files.removeTree(folder);
  }

  /** git's own folder for a worktree, named by the `.git` file in it; null when there is no such file. */
  private async adminFolderOf(folder: string): Promise<string | null> {
    const text = await this.dependencies.files.read(join(folder, '.git'));
    const named = text === null ? undefined : GITDIR_LINE.exec(text)?.[1];
    return named ? resolve(folder, named) : null;
  }

  private markerText = (pull: number): string => `pull ${pull}\n`;

  private async isOwned(folder: string, pull: number): Promise<boolean> {
    const admin = await this.adminFolderOf(folder);
    if (!admin) return false;
    return (await this.dependencies.files.read(join(admin, MARKER_FILE))) === markerText(pull);
  }

  private async markOwned(folder: string, pull: number): Promise<boolean> {
    const admin = await this.adminFolderOf(folder);
    if (!admin) return false;
    await this.dependencies.files.append(join(admin, MARKER_FILE), markerText(pull));
    return true;
  }

  /** Puts `.claude/worktrees/` in the clone's own exclude file, which is never committed. */
  private async excludeWorktrees(clone: string): Promise<string | null> {
    const located = await this.git(['-C', clone, 'rev-parse', '--git-common-dir'], GIT_LIMIT_MS);
    if (located.code !== 0) {
      return describeFailure('Finding the clone’s git folder', located, GIT_LIMIT_MS);
    }
    const exclude = join(resolve(clone, located.stdout.trim()), 'info', 'exclude');
    const { files } = this.dependencies;
    const text = (await files.read(exclude)) ?? '';
    if (text.split(/\r?\n/).some(excludesWorktrees)) return null;
    const lineBreak = text && !text.endsWith('\n') ? '\n' : '';
    await files.append(exclude, `${lineBreak}${EXCLUDE_PATTERN}\n`);
    return null;
  }

  /** Removes the worktree of every closed pull request that no server is using. */
  private async pruneClosed(request: PullPrepareRequest): Promise<void> {
    const { clone, pull, isInUse } = request;
    const { files } = this.dependencies;
    for (const entry of await files.list(join(clone, ...WORKTREES))) {
      const number = Number(PULL_FOLDER_NAME.exec(entry.name)?.[1]);
      if (!entry.isFolder || !number || number === pull || isInUse(number)) continue;
      try {
        const problem = await this.inQueue(clone, number, () =>
          this.pruneIfClosed(request, number),
        );
        if (problem) console.error(problem);
      } catch (error: unknown) {
        // Whether it is closed is not known, so the worktree stays.
        console.error(`Could not tell whether pull request ${number} is closed:`, error);
      }
    }
  }

  /** Runs in the worktree's queue, so a start or a stop of it cannot overlap, and asks again whether it is in use. */
  private async pruneIfClosed(request: PullPrepareRequest, number: number): Promise<string | null> {
    const { repo, clone, isInUse } = request;
    const folder = pullFolder(clone, number);
    if (!folder || isInUse(number) || !(await this.isOwned(folder, number))) return null;
    if (await this.dependencies.pulls.isOpen(repo, number)) return null;
    return this.removeNow(clone, number, folder);
  }

  /** Fetches the head, fork or not, into a ref of our own, and names its commit. */
  private async fetchHead(
    request: PullPrepareRequest,
  ): Promise<{ readonly sha: string } | { readonly why: string }> {
    const { clone, pull, signal } = request;
    const fetched = await this.git(
      [
        '-C',
        clone,
        'fetch',
        '--no-write-fetch-head',
        'origin',
        `+refs/pull/${pull}/head:${pullRef(pull)}`,
      ],
      GIT_LIMIT_MS,
      signal,
    );
    if (fetched.code !== 0) {
      return { why: describeFailure(`Fetching pull request ${pull}`, fetched, GIT_LIMIT_MS) };
    }
    const head = await this.git(
      ['-C', clone, 'rev-parse', '--verify', `${pullRef(pull)}^{commit}`],
      GIT_LIMIT_MS,
    );
    const sha = head.stdout.trim();
    return head.code === 0 && COMMIT_HASH.test(sha)
      ? { sha }
      : { why: describeFailure(`Reading the head of pull request ${pull}`, head, GIT_LIMIT_MS) };
  }

  /** The head in a worktree at `folder`: made if there is none, refreshed if a past preview left one. */
  private async checkOut(
    request: PullPrepareRequest,
    folder: string,
    sha: string,
  ): Promise<CheckedOut> {
    if (!(await this.dependencies.files.exists(folder)))
      return this.addWorktree(request, folder, sha);
    if (!(await this.isOwned(folder, request.pull))) return { why: inTheWay(folder) };
    return this.refresh(request, folder, sha);
  }

  private async addWorktree(
    { clone, pull, signal }: PullPrepareRequest,
    folder: string,
    sha: string,
  ): Promise<CheckedOut> {
    const added = await this.git(
      ['-C', clone, 'worktree', 'add', '--detach', folder, sha],
      GIT_LIMIT_MS,
      signal,
    );
    const isMarked = added.code === 0 && (await this.markOwned(folder, pull));
    if (isMarked) return { needsInstall: true };
    // The folder was not there a moment ago, so whatever is there now is this attempt's.
    if (await this.dependencies.files.exists(folder)) await this.deleteFolder(clone, folder);
    await this.git(['-C', clone, 'worktree', 'prune'], GIT_LIMIT_MS);
    return {
      why:
        added.code === 0
          ? `Could not mark the worktree of pull request ${pull} as Observatory’s.`
          : describeFailure(`Checking out pull request ${pull}`, added, GIT_LIMIT_MS),
    };
  }

  /** Moves a worktree this module made to the new head, unless the owner changed something in it. */
  private async refresh(
    { pull, signal }: PullPrepareRequest,
    folder: string,
    sha: string,
  ): Promise<CheckedOut> {
    const status = await this.git(['-C', folder, 'status', '--porcelain'], GIT_LIMIT_MS, signal);
    if (status.code !== 0) {
      return {
        why: describeFailure(
          `Reading the state of pull request ${pull}’s worktree`,
          status,
          GIT_LIMIT_MS,
        ),
      };
    }
    const changed = status.stdout
      .split(/\r?\n/)
      .map((line) => line.slice(3).trim())
      .filter((path) => path && !MADE_BY_PREVIEW.test(path));
    if (changed.length > 0) {
      return {
        why: `The preview worktree of pull request ${pull} has changes that are not Observatory’s (${changed.slice(0, 3).join(', ')}), so it was not refreshed. Remove the preview to start fresh.`,
      };
    }
    const dependenciesChanged = await this.dependenciesDiffer(folder, sha, signal);
    const result = await this.git(
      ['-C', folder, 'checkout', '--detach', '--force', sha],
      GIT_LIMIT_MS,
      signal,
    );
    return result.code === 0
      ? { needsInstall: dependenciesChanged }
      : { why: describeFailure(`Checking out pull request ${pull}`, result, GIT_LIMIT_MS) };
  }

  /** Whether the worktree's package files differ from those of `sha`; any doubt says they do. */
  private async dependenciesDiffer(
    folder: string,
    sha: string,
    signal: AbortSignal,
  ): Promise<boolean> {
    const diff = await this.git(
      ['-C', folder, 'diff', '--quiet', 'HEAD', sha, '--', ...DEPENDENCY_FILES],
      GIT_LIMIT_MS,
      signal,
    );
    return diff.code !== 0;
  }

  /** `.env` files the clone has and the worktree lacks, so the app can read its settings. */
  private async copyEnvFiles(clone: string, folder: string): Promise<void> {
    const { files } = this.dependencies;
    for (const entry of await files.list(clone)) {
      if (entry.isFile && ENV_FILE.test(entry.name)) {
        await files.copy(join(clone, entry.name), join(folder, entry.name));
      }
    }
  }

  /** Installs what the lockfile says, unless the same dependencies are already completely installed. */
  private async install(
    { pull, signal, onPhase }: PullPrepareRequest,
    folder: string,
    needsInstall: boolean,
  ): Promise<string | null> {
    const { files, tools } = this.dependencies;
    if (!(await files.exists(join(folder, 'package.json')))) return null;
    if (!needsInstall && (await files.exists(join(folder, INSTALLED_MARKER)))) return null;
    if (signal.aborted) return STOPPED_MEANWHILE;
    onPhase('installing');
    const command = (await files.exists(join(folder, 'package-lock.json'))) ? 'ci' : 'install';
    const call: ToolCall = { tool: 'npm', cwd: folder, command };
    const result = await tools.run(call, { signal, limitMs: INSTALL_LIMIT_MS });
    return result.code === 0
      ? null
      : describeFailure(
          `Installing the dependencies of pull request ${pull} (npm ${command})`,
          result,
          INSTALL_LIMIT_MS,
        );
  }
}
