import type { PullBucket } from '../projects/pull-counts.ts';
import type { LandedBase } from './landed-base.ts';

/**
 * What a crew does: bring a conflicted branch up to date, fix failing checks,
 * or update a branch whose base has merged.
 */
export type CrewTask = 'update-branch' | 'fix-checks' | 'update-stack';

/** The pull request a crew is sent to, as the queue reads it. */
interface CrewBranches {
  readonly repo: string;
  readonly number: number;
  readonly branch: string;
  readonly base: string;
}

/** A crew that clears a stuck pull request. */
interface ClearTarget extends CrewBranches {
  readonly task: 'update-branch' | 'fix-checks';
}

/** A crew that updates a pull request stacked on one that has merged. */
interface StackTarget extends CrewBranches {
  readonly task: 'update-stack';
  readonly landed: LandedBase;
}

export type CrewTarget = ClearTarget | StackTarget;

/**
 * Every crew prompt's first line starts with this, then `owner/name#number`.
 * The page finds which pull request a run belongs to by it
 * (src/app/core/crew/crew-tag.ts), so the two must change together.
 */
export const CREW_TAG = 'Observatory crew ship for';

/** A branch name git allows that cannot be read as an option or break out of a
 *  line of the prompt. */
const SAFE_BRANCH = /^[A-Za-z0-9._][A-Za-z0-9._/-]{0,199}$/;

const TASKS: Readonly<Partial<Record<PullBucket, ClearTarget['task']>>> = {
  conflicted: 'update-branch',
  failing: 'fix-checks',
};

/** The crew's task for a pull request in `bucket`, or null when it needs none. */
export const crewTaskOf = (bucket: PullBucket): ClearTarget['task'] | null => TASKS[bucket] ?? null;

/** Whether `name` is safe to write into a crew's instructions. */
export const isSafeBranch = (name: string): boolean =>
  SAFE_BRANCH.test(name) && !name.includes('..');

const scopeOf = (target: CrewTarget): string[] => [
  `You are a crew Observatory sent to clear pull request #${target.number} in ${target.repo}, so it can merge.`,
  `Its head branch is \`${target.branch}\` and it merges into \`${target.base}\`.`,
  '',
  'Ground rules:',
  '- Leave this checkout as you found it: its branch and any uncommitted work belong to the owner.',
  `- Work in a temporary worktree instead: \`git fetch origin\`, then \`git worktree add --detach <a new temporary folder> origin/${target.branch}\`, and work there.`,
  `- Push only to the pull request's own branch, with a plain \`git push origin HEAD:${target.branch}\`.`,
  '- Never force-push, rewrite published history, merge the pull request, close it, or push to any other branch.',
  '- When you are done, remove the temporary worktree with `git worktree remove`.',
];

const MERGE_NOT_REBASE = 'Merge rather than rebase: a rebase would need a force-push.';

const CLEAR_STEPS: Readonly<Record<ClearTarget['task'], (target: ClearTarget) => string[]>> = {
  'update-branch': (target) => [
    `The task: the branch conflicts with \`${target.base}\`. Merge \`origin/${target.base}\` into it and resolve every conflict, keeping what both sides meant.`,
    MERGE_NOT_REBASE,
    'Build and test as the project documents, commit the merge, and push.',
  ],
  'fix-checks': (target) => [
    `The task: its checks are failing. Read them with \`gh pr checks ${target.number} --repo ${target.repo}\` and the failed logs with \`gh run view <run id> --repo ${target.repo} --log-failed\`.`,
    'Find the cause and fix it with the smallest change that does, run the failing check locally where you can, then commit with a Conventional Commit message and push.',
  ],
};

const stackSteps = ({ repo, number, landed }: StackTarget): string[] => [
  `The task: it was stacked on pull request #${landed.number}, whose branch \`${landed.branch}\` has merged into \`${landed.into}\`. Merge \`origin/${landed.into}\` into this branch and resolve every conflict, keeping what this branch meant.`,
  MERGE_NOT_REBASE,
  'Build and test as the project documents, commit the merge, and push.',
  `Then point the pull request at \`${landed.into}\` with \`gh pr edit ${number} --repo ${repo} --base ${landed.into}\`, so it no longer merges into a finished branch.`,
  `If \`${landed.branch}\` is still in use, taking work that is not in \`${landed.into}\`, change nothing and say so.`,
];

const stepsOf = (target: CrewTarget): string[] =>
  target.task === 'update-stack' ? stackSteps(target) : CLEAR_STEPS[target.task](target);

const CLOSING = [
  '',
  'Finish with a short summary of what you changed and pushed, or of why the pull request could not be cleared.',
];

/** The instructions a crew runs with. */
export function crewPrompt(target: CrewTarget): string {
  return [
    `${CREW_TAG} ${target.repo}#${target.number}: ${target.task}`,
    '',
    ...scopeOf(target),
    '',
    ...stepsOf(target),
    ...CLOSING,
  ].join('\n');
}
