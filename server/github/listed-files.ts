import type { PullFiles } from '../collisions/collision-pairs.ts';

/** An open pull request's `number` and `files`, as `gh pr list --json` lists them. */
export interface ListedFiles {
  readonly number: number;
  readonly files: readonly { readonly path: string }[] | null;
}

/** Each pull request with the paths it changes. */
export const pullFilesOf = (pulls: readonly ListedFiles[]): PullFiles[] =>
  pulls.map((pull) => ({
    number: pull.number,
    files: (pull.files ?? []).map((file) => file.path),
  }));
