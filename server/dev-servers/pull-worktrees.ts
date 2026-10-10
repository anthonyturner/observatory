import { join, relative, resolve } from 'node:path';
import type { StartPhase } from './dev-server-types.ts';
import type { ToolCall, ToolResult, ToolRunner } from './tool-runner.ts';
import type { WorktreeFiles } from './worktree-files.ts';

/** Which pull requests are still open, so a worktree of a closed one can go. */
export interface PullStates {
  isOpen(repo: string, pull: number): Promise<boolean>;
}

/** What a preview of one pull request is asked to set up. */
export interface PrepareRequest {
  readonly repo: string;
  /** The project's clone, from the registry. */
  readonly clone: string;
  readonly pull: number;
  /** Pull requests whose worktrees a server is running in, which pruning leaves alone. */
  readonly inUse: readonly number[];
  /** Stopping the preview aborts this, and with it any command in flight. */
  readonly signal: AbortSignal;
  readonly onPhase: (phase: Extract<StartPhase, 'fetching' | 'installing'>) => void;
}

/** A folder to run the pull request's head in, or why there is not one. */
export type Prepared = { readonly folder: string } | { readonly why: string };

export interface PullWorktreeDependencies {
  readonly tools: ToolRunner;
  readonly files: WorktreeFiles;
  readonly pulls: PullStates;
}

const WORKTREES = ['.claude', 'worktrees'];
const PULL_FOLDER = /^pr-[1-9]\d*$/;
const PULL_FOLDER_NAME = /^pr-([1-9]\d*)$/;
/** Keeps the worktrees out of `git status` in the clone. */
const EXCLUDE_PATTERN = '.claude/worktrees/';
/** A line of an exclude file that already covers the worktrees, with or without its slashes. */
const excludesWorktrees = (line: string): boolean =>
  line.trim().replace(/^\/|\/$/g, '') === '.claude/worktrees';
/** The `.env` files an app reads, which git ignores and so a new worktree lacks. */
const ENV_FILE = /^\.env(\..+)?$/;
const DEPENDENCY_FILES = ['package.json', 'package-lock.json'];
/** npm writes this when an install completes, so a folder with it holds a whole one. */
const INSTALLED_MARKER = join('node_modules', '.package-lock.json');

/** A full commit hash, which cannot be read as an option when it is passed to git. */
const COMMIT_HASH = /^[0-9a-f]{40,64}$/;

const GIT_LIMIT_MS = 2 * 60_000;
/** A cold install of a large project is slow; this is separate from the server's own start limit. */
const INSTALL_LIMIT_MS = 10 * 60_000;
/** Deleting node_modules is slow on Windows. */
const REMOVE_LIMIT_MS = 5 * 60_000;
const MS_PER_MINUTE = 60_000;

export const NOT_A_PULL_FOLDER =
  'Refused to remove a folder that is not a pull request’s worktree.';
export const STOPPED_MEANWHILE = 'The preview was stopped.';

/** The folder of the pull request's worktree, or null for a number that is not a pull request's. */
export function pullFolder(clone: string, pull: number): string | null {
  return Number.isSafeInteger(pull) && pull >= 1 ? join(clone, ...WORKTREES, `pr-${pull}`) : null;
}

/**
 * Whether `folder` is exactly one pull request's worktree of `clone`: directly
 * under its worktrees folder, named `pr-` and a number. The one test a delete
 * has to pass; nothing deeper, nearby or outside it does.
 */
export function isPullFolder(clone: string, folder: string): boolean {
  return PULL_FOLDER.test(relative(join(clone, ...WORKTREES), resolve(folder)));
}

const quoted = (line: string): string => `"${line}"`;

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
 * clone, ready to run: fetched, detached so no branch appears in the user's
 * repository, and with its dependencies installed. Every command is built here
 * from a validated number and the registry's clone, never from request text.
 */
export class PullWorktrees {
  private readonly dependencies: PullWorktreeDependencies;
  /** For the commands nothing stops: a removal always runs to the end. */
  private readonly never = new AbortController().signal;

  constructor(dependencies: PullWorktreeDependencies) {
    this.dependencies = dependencies;
  }

  /** Sets up the worktree, or refreshes the one a past preview left. */
  async prepare(request: PrepareRequest): Promise<Prepared> {
    const { clone, pull, onPhase } = request;
    const folder = pullFolder(clone, pull);
    if (!folder) return { why: `${pull} is not a pull request number.` };
    try {
      onPhase('fetching');
      const excluded = await this.excludeWorktrees(clone);
      if (excluded) return { why: excluded };
      await this.pruneClosed(request);
      const head = await this.fetchHead(request);
      if ('why' in head) return head;
      const checkedOut = await this.checkOut(request, folder, head.sha);
      if ('why' in checkedOut) return checkedOut;
      await this.copyEnvFiles(clone, folder);
      const installed = await this.install(request, folder, checkedOut.needsInstall);
      return installed ? { why: installed } : { folder };
    } catch (error: unknown) {
      return { why: `Could not set up the worktree: ${(error as Error).message}` };
    }
  }

  /**
   * Removes the pull request's worktree and what it holds, or says why it
   * could not. One that is already gone is removed.
   */
  async remove(clone: string, pull: number): Promise<string | null> {
    const folder = pullFolder(clone, pull);
    if (!folder || !isPullFolder(clone, folder)) return NOT_A_PULL_FOLDER;
    try {
      const removed = await this.git(
        ['-c', 'core.longpaths=true', '-C', clone, 'worktree', 'remove', '--force', folder],
        REMOVE_LIMIT_MS,
      );
      if (removed.code !== 0) {
        // git cannot always delete a deep node_modules on Windows; deleting it here can.
        await this.deleteFolder(clone, folder);
        await this.git(['-C', clone, 'worktree', 'prune'], GIT_LIMIT_MS);
      }
      return null;
    } catch (error: unknown) {
      return `The worktree of pull request ${pull} could not be removed: ${(error as Error).message}`;
    }
  }

  /** Ends any git or npm still running, at once: for the API's exit. */
  shutdown(): void {
    this.dependencies.tools.shutdown();
  }

  private git(
    args: readonly string[],
    limitMs: number,
    signal: AbortSignal = this.never,
  ): Promise<ToolResult> {
    return this.dependencies.tools.run({ tool: 'git', args }, { signal, limitMs });
  }

  /** The only place a folder is deleted, and only after it proves to be a pull request's worktree. */
  private async deleteFolder(clone: string, folder: string): Promise<void> {
    if (!isPullFolder(clone, folder)) throw new Error(NOT_A_PULL_FOLDER);
    await this.dependencies.files.removeTree(folder);
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
  private async pruneClosed({ repo, clone, pull, inUse }: PrepareRequest): Promise<void> {
    const { files, pulls } = this.dependencies;
    for (const entry of await files.list(join(clone, ...WORKTREES))) {
      const number = Number(PULL_FOLDER_NAME.exec(entry.name)?.[1]);
      if (!entry.isFolder || !number || number === pull || inUse.includes(number)) continue;
      try {
        if (!(await pulls.isOpen(repo, number))) await this.remove(clone, number);
      } catch (error: unknown) {
        // Whether it is closed is not known, so the worktree stays.
        console.error(`Could not tell whether pull request ${number} of ${repo} is closed:`, error);
      }
    }
  }

  /** Fetches the head, fork or not, and names its commit. */
  private async fetchHead(
    request: PrepareRequest,
  ): Promise<{ readonly sha: string } | { readonly why: string }> {
    const { clone, pull, signal } = request;
    const fetched = await this.git(
      ['-C', clone, 'fetch', 'origin', `pull/${pull}/head`],
      GIT_LIMIT_MS,
      signal,
    );
    if (fetched.code !== 0) {
      return { why: describeFailure(`Fetching pull request ${pull}`, fetched, GIT_LIMIT_MS) };
    }
    const head = await this.git(['-C', clone, 'rev-parse', '--verify', 'FETCH_HEAD'], GIT_LIMIT_MS);
    const sha = head.stdout.trim();
    return head.code === 0 && COMMIT_HASH.test(sha)
      ? { sha }
      : { why: describeFailure(`Reading the head of pull request ${pull}`, head, GIT_LIMIT_MS) };
  }

  /** The head in a worktree at `folder`: made if there is none, refreshed if a past preview left one. */
  private async checkOut(
    { clone, pull, signal }: PrepareRequest,
    folder: string,
    sha: string,
  ): Promise<CheckedOut> {
    const { files } = this.dependencies;
    const isWorktree = await files.exists(join(folder, '.git'));
    if (!isWorktree && (await files.exists(folder))) {
      // Left without git's record of it, which makes git refuse to add over it.
      await this.deleteFolder(clone, folder);
      await this.git(['-C', clone, 'worktree', 'prune'], GIT_LIMIT_MS, signal);
    }
    const dependenciesChanged = isWorktree && (await this.dependenciesDiffer(folder, sha, signal));
    const result = await this.git(
      isWorktree
        ? ['-C', folder, 'checkout', '--detach', '--force', sha]
        : ['-C', clone, 'worktree', 'add', '--detach', folder, sha],
      GIT_LIMIT_MS,
      signal,
    );
    if (result.code !== 0) {
      return { why: describeFailure(`Checking out pull request ${pull}`, result, GIT_LIMIT_MS) };
    }
    return { needsInstall: !isWorktree || dependenciesChanged };
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
    { pull, signal, onPhase }: PrepareRequest,
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
