import { AgentChanges, ChangesProblem } from './agent-changes.types';
import { LiveAgentKey } from './live-agents.types';

/** What a Changes tab says in place of a diff, for each reason there is none. */
const PROBLEM_TEXT: Readonly<Record<ChangesProblem, string>> = {
  'no-folder': "This agent's transcript doesn't name a folder yet, so there is nothing to compare.",
  'folder-gone':
    "This agent's folder is gone, and its branch isn't in the checkout any more, so its changes can't be read.",
  'not-a-repo': "This agent's folder isn't in a git repository, so there are no changes to show.",
  'no-base':
    'This repository has no origin/HEAD, origin/main or origin/master to compare with. Fetch it once, then refresh.',
  'git-failed': "Git couldn't read this folder's changes.",
  'timed-out': "Git took too long reading this folder's changes.",
};

/** A problem worth trying again: git may answer next time. */
const RETRYABLE_PROBLEMS: ReadonlySet<ChangesProblem> = new Set(['git-failed', 'timed-out']);

export const problemText = (problem: ChangesProblem): string => PROBLEM_TEXT[problem];

export const canRetry = (problem: ChangesProblem): boolean => RETRYABLE_PROBLEMS.has(problem);

export const SHARED_CHECKOUT_TEXT =
  'This folder is the shared main checkout. These changes may belong to another session, not this agent.';

/** SheetDiff's notes for an agent's diff: the folder has the rest, not GitHub. */
export const AGENT_DIFF_WORDING = {
  tooLarge: 'Run git diff in the folder to see it.',
  cutShort:
    'Shortened to fit. Files near the end may be missing; git diff in the folder has them all.',
} as const;

/** The local API's limits on untracked files (server/live-agents/untracked-diff.ts). */
const UNTRACKED_LIMIT_KB = 256;
const UNTRACKED_CAP = 200;

const untrackedFiles = (count: number): string =>
  count === 1 ? '1 untracked file' : `${count} untracked files`;

export const comparedText = ({ base }: AgentChanges): string =>
  `Compared with ${base} as of the last fetch.`;

/** Said once the folder is gone: what is shown, and from where. */
export function committedOnlyText({ branch, readFrom }: AgentChanges): string {
  const where = branch ? `${branch}, read from ${readFrom}` : readFrom;
  return `This folder is gone, so only its committed changes show: ${where}. Anything never committed went with it.`;
}

/** What the diff leaves out among untracked files, one note each. */
export function untrackedNotes({ skippedLarge, untrackedOverCap }: AgentChanges): string[] {
  const notes: string[] = [];
  if (skippedLarge.length) {
    notes.push(
      `${untrackedFiles(skippedLarge.length)} over ${UNTRACKED_LIMIT_KB} KB not shown: ${skippedLarge.join(', ')}.`,
    );
  }
  if (untrackedOverCap) {
    notes.push(`${untrackedFiles(untrackedOverCap)} past the first ${UNTRACKED_CAP} not shown.`);
  }
  return notes;
}

/** No diff to draw: nothing changed, or only files left out for their size or number. */
export const hasNoDiff = ({ diff, diffTruncated }: AgentChanges): boolean =>
  !diff && !diffTruncated;

/** Said in place of an empty diff; "other" when the notes above name files left out. */
export const noChangesText = (changes: AgentChanges): string =>
  untrackedNotes(changes).length
    ? `No other changes against ${changes.base}.`
    : `No changes yet against ${changes.base}.`;

/** Names this agent's diff for its viewed ticks. */
export const agentChangesDiffKey = ({ session, agentId }: LiveAgentKey): string =>
  `agent:${session}/${agentId ?? 'session'}`;

/** The Review Queue address of `repo` (`owner/name`); `?pr=` opens one pull request there. */
export const queuePathOf = (repo: string): readonly string[] => ['/p', ...repo.split('/')];
