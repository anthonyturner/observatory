import { MergeMethod } from '../../../../core/edits/edit-record';

/** GitHub's own words for each way of merging, so the box reads like GitHub's. */
export interface MethodWords {
  readonly button: string;
  readonly menu: string;
  readonly hint: string;
  readonly confirm: string;
  /** How it merged: "Merged via squash". */
  readonly via: string;
}

export const METHOD_WORDS: Readonly<Record<MergeMethod, MethodWords>> = {
  squash: {
    button: 'Squash and merge',
    menu: 'Squash and merge',
    hint: 'The commits are combined into one commit on the base branch.',
    confirm: 'Confirm squash and merge',
    via: 'squash',
  },
  merge: {
    button: 'Merge pull request',
    menu: 'Create a merge commit',
    hint: 'All commits are added to the base branch with a merge commit.',
    confirm: 'Confirm merge',
    via: 'a merge commit',
  },
  rebase: {
    button: 'Rebase and merge',
    menu: 'Rebase and merge',
    hint: 'The commits are added to the base branch one by one, rebased.',
    confirm: 'Confirm rebase and merge',
    via: 'rebase',
  },
};
