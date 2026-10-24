import { PullFile } from '../../../core/queue/pull-file';
import { PullFileFeedState } from '../../../core/queue/pull-file-feed';

const BYTES_PER_KB = 1024;
const SHORT_SHA_LENGTH = 7;

/** What stands in place of the file's lines: a headline, what to do, and where to read it. */
export interface FileMessage {
  readonly headline: string;
  readonly detail?: string;
  readonly link?: { readonly label: string; readonly url: string };
}

export const NOT_A_FILE: FileMessage = {
  headline: 'This address does not name a file of a pull request',
  detail: 'Open a file from the Diff tab of a pull request.',
};

/** What to say while there is no file to show, or null once there is one to draw. */
export function stateMessage(state: PullFileFeedState): FileMessage | null {
  switch (state.status) {
    case 'reading':
      return { headline: 'Opening the file…' };
    case 'unreachable':
      return {
        headline: 'Could not read the file',
        detail: 'GitHub or the API did not answer. Try again in a moment.',
      };
    case 'ready':
      return fileMessage(state.file);
  }
}

/** What stands in place of a file whose lines are not shown, or null for one that is. */
export function fileMessage(file: PullFile): FileMessage | null {
  switch (file.state) {
    case 'shown':
      return null;
    case 'hidden':
      return {
        headline: 'This repository is private, so its code is not shown in the preview',
        detail: 'Sign in to see it.',
      };
    case 'too-large':
      return {
        headline: `This file is too large to show here (${Math.round(file.bytes / BYTES_PER_KB)} KB).`,
        link: { label: 'Open it on GitHub.', url: file.githubUrl },
      };
    case 'binary':
      return {
        headline: 'This is a binary file, so it is not shown.',
        link: { label: 'Open it on GitHub.', url: file.githubUrl },
      };
    case 'missing':
      return {
        headline: 'This file is not in the pull request at that commit.',
        detail: 'It may have been renamed or removed since.',
        link: { label: 'Open the pull request on GitHub.', url: file.githubUrl },
      };
  }
}

export const MISMATCH_NOTE =
  'These changes do not match this version of the file, so none are marked.';

export const CHANGES_UNAVAILABLE_NOTE =
  'GitHub would not give the changes to this file, so none are marked.';

export const CHANGES_UNAVAILABLE_LABEL = 'Changes not available';

export const shortSha = (sha: string): string => sha.slice(0, SHORT_SHA_LENGTH);

/** "Change 2 of 5", or that there are none to step through. */
export function changeLabel(index: number, count: number): string {
  return count === 0 ? 'No changes to show' : `Change ${index + 1} of ${count}`;
}
