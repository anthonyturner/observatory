import { stat } from 'node:fs/promises';
import { fitDiff } from '../queue/pull-size.ts';
import { checkoutFolderOf, resolveProject, worktreeRootOf } from '../usage/checkout-projects.ts';
import type { ProjectOf } from '../usage/project-usage.ts';
import { SESSION_LOGS_DIR } from '../usage/usage-paths.ts';
import type {
  AgentChanges,
  AgentChangesAnswer,
  ChangesDiff,
  ChangesGap,
  ChangesProblem,
} from './agent-changes-types.ts';
import { type RootOf, type WorkPlace, workPlaceOf } from './changes-folder.ts';
import {
  type Base,
  ChangesFailure,
  baseOf,
  branchNameOf,
  branchOf,
  checkoutOf,
  commitOf,
  isRefName,
  mergeBaseOf,
} from './git-facts.ts';
import type { AgentKey } from './live-agent-types.ts';
import { type Git, GitTimedOut, readOnlyGit } from './read-only-git.ts';
import { transcriptOf } from './transcript-files.ts';
import { tailLines } from './transcript-window.ts';
import { DIFF_OPTIONS, untrackedDiff } from './untracked-diff.ts';

/** What reading an agent's changes needs from the machine; a test gives its own. */
export interface ChangesSources {
  readonly logsDir: string;
  readonly git: Git;
  readonly projectOf: ProjectOf;
  /** The checkout a folder is in, or was in once it is gone, or null. */
  readonly checkoutFolderOf: (cwd: string) => string | null;
  readonly rootOf: RootOf;
}

const DEFAULT_SOURCES: ChangesSources = {
  logsDir: SESSION_LOGS_DIR,
  git: readOnlyGit(),
  projectOf: resolveProject,
  checkoutFolderOf,
  rootOf: worktreeRootOf,
};

/** Reads one agent's changes; the routes know nothing of how. */
export interface ChangesSource {
  changes(key: AgentKey): Promise<AgentChangesAnswer>;
}

interface Diffed {
  readonly diff: string;
  readonly isCut: boolean;
}

const gap = (problem: ChangesProblem, folder: string | null): ChangesGap => ({
  kind: 'problem',
  problem,
  folder,
});

function problemOf(error: unknown): ChangesProblem {
  if (error instanceof ChangesFailure) return error.problem;
  return error instanceof GitTimedOut ? 'timed-out' : 'git-failed';
}

async function isFolder(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Tracked files' changes since `from`: to the working tree, or to `to`. */
async function trackedDiff(git: Git, top: string, revs: readonly string[]): Promise<Diffed> {
  const answer = await git(top, ['diff', ...DIFF_OPTIONS, ...revs, '--']);
  if (answer.code !== 0) throw new ChangesFailure('git-failed');
  return { diff: answer.stdout, isCut: answer.isCut };
}

/** Where git was read, and what with. */
interface Compared {
  readonly place: WorkPlace;
  readonly readFrom: string;
  readonly branch: string | null;
  readonly base: Base;
  readonly repo: string | null;
}

/** What was found there. */
type Found = Diffed &
  Pick<ChangesDiff, 'isCommittedOnly' | 'isSharedCheckout' | 'skippedLarge' | 'untrackedOverCap'>;

function diffOf(compared: Compared, { diff, isCut, ...shape }: Found): ChangesDiff {
  return fitDiff({
    kind: 'diff',
    folder: compared.place.cwd,
    readFrom: compared.readFrom,
    branch: compared.branch,
    base: compared.base.name,
    repo: compared.repo,
    ...shape,
    diff,
    diffBytes: Buffer.byteLength(diff, 'utf8'),
    diffTruncated: isCut,
  });
}

/** Committed, staged, unstaged and untracked changes in the folder, against
 *  where its HEAD left the base. */
async function workingTreeChanges(place: WorkPlace, sources: ChangesSources): Promise<ChangesDiff> {
  const { git } = sources;
  const checkout = await checkoutOf(git, place.cwd);
  const top = checkout.toplevel;
  const [branch, base] = await Promise.all([branchOf(git, top), baseOf(git, top)]);
  if (!base) throw new ChangesFailure('no-base');
  const mergeBase = await mergeBaseOf(git, top, 'HEAD', base);
  const [tracked, untracked] = await Promise.all([
    trackedDiff(git, top, [mergeBase]),
    untrackedDiff(git, top),
  ]);
  const repo = sources.projectOf(place.cwd).repo;
  return diffOf(
    { place, readFrom: top, branch, base, repo },
    {
      diff: tracked.diff + untracked.diff,
      isCut: tracked.isCut,
      isCommittedOnly: false,
      isSharedCheckout: checkout.isPrimary && branch === branchNameOf(base),
      skippedLarge: untracked.skippedLarge,
      untrackedOverCap: untracked.overCap,
    },
  );
}

/** A removed worktree's branch, as its checkout still has it: commits only,
 *  since whatever was never committed went with the folder. */
async function committedChanges(place: WorkPlace, sources: ChangesSources): Promise<ChangesDiff> {
  const { git } = sources;
  const checkout = sources.checkoutFolderOf(place.cwd);
  const branch = place.branch;
  if (!checkout || !branch || !isRefName(branch)) throw new ChangesFailure('folder-gone');
  const head = await commitOf(git, checkout, `refs/heads/${branch}`);
  if (!head) throw new ChangesFailure('folder-gone');
  const base = await baseOf(git, checkout);
  if (!base) throw new ChangesFailure('no-base');
  const mergeBase = await mergeBaseOf(git, checkout, head, base);
  const tracked = await trackedDiff(git, checkout, [mergeBase, head]);
  const repo = sources.projectOf(place.cwd).repo;
  return diffOf(
    { place, readFrom: checkout, branch, base, repo },
    {
      ...tracked,
      isCommittedOnly: true,
      isSharedCheckout: false,
      skippedLarge: [],
      untrackedOverCap: 0,
    },
  );
}

/** The changes in the folder `place` names, or the problem that stopped them being read. */
export async function changesIn(place: WorkPlace, sources: ChangesSources): Promise<AgentChanges> {
  try {
    return (await isFolder(place.cwd))
      ? await workingTreeChanges(place, sources)
      : await committedChanges(place, sources);
  } catch (error) {
    return gap(problemOf(error), place.cwd);
  }
}

/** One agent's changes, in the folder its own transcript names: a request
 *  carries ids only, so it can never point git at a folder of its choosing. */
export function agentChangesReader(
  sources = DEFAULT_SOURCES,
  clock: () => number = Date.now,
): ChangesSource {
  return {
    async changes(key) {
      const transcript = await transcriptOf(sources.logsDir, key);
      const place = transcript
        ? workPlaceOf(await tailLines(transcript.file), sources.rootOf)
        : null;
      const changes = place ? await changesIn(place, sources) : gap('no-folder', null);
      return { generatedAt: new Date(clock()).toISOString(), changes };
    },
  };
}
