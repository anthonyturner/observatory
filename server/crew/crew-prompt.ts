import type { PullBucket } from '../projects/pull-counts.ts';

/** What a crew does: bring a conflicted branch up to date, or fix failing checks. */
export type CrewTask = 'update-branch' | 'fix-checks';

/** The pull request a crew is sent to, as the queue reads it. */
export interface CrewTarget {
  readonly repo: string;
  readonly number: number;
  readonly branch: string;
  readonly base: string;
  readonly task: CrewTask;
}

/**
 * Every crew prompt's first line starts with this, then `owner/name#number`.
 * The page finds which pull request a run belongs to by it
 * (src/app/core/crew/crew-tag.ts), so the two must change together.
 */
export const CREW_TAG = 'Observatory crew ship for';

/** A branch name git allows that cannot be read as an option or break out of a
 *  line of the prompt. */
const SAFE_BRANCH = /^[A-Za-z0-9._][A-Za-z0-9._/-]{0,199}$/;

const TASKS: Readonly<Partial<Record<PullBucket, CrewTask>>> = {
  conflicted: 'update-branch',
  failing: 'fix-checks',
};

/** The crew's task for a pull request in `bucket`, or null when it needs none. */
export const crewTaskOf = (bucket: PullBucket): CrewTask | null => TASKS[bucket] ?? null;

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

const STEPS: Readonly<Record<CrewTask, (target: CrewTarget) => string[]>> = {
  'update-branch': (target) => [
    `The task: the branch conflicts with \`${target.base}\`. Merge \`origin/${target.base}\` into it and resolve every conflict, keeping what both sides meant.`,
    'Merge rather than rebase: a rebase would need a force-push.',
    'Build and test as the project documents, commit the merge, and push.',
  ],
  'fix-checks': (target) => [
    `The task: its checks are failing. Read them with \`gh pr checks ${target.number} --repo ${target.repo}\` and the failed logs with \`gh run view <run id> --repo ${target.repo} --log-failed\`.`,
    'Find the cause and fix it with the smallest change that does, run the failing check locally where you can, then commit with a Conventional Commit message and push.',
  ],
};

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
    ...STEPS[target.task](target),
    ...CLOSING,
  ].join('\n');
}
