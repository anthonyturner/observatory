import { SinceLookDiff } from '../../../../core/queue/since-look';
import { SinceLookState } from '../../../../core/queue/since-look-feed';

/** Which diff the Diff tab shows: the whole pull request's, with a note saying
 *  why when the changes since the last look were wanted; or just those. */
export type DiffShown =
  | { readonly kind: 'full'; readonly note: string | null }
  | { readonly kind: 'reading' }
  | { readonly kind: 'since'; readonly since: SinceLookDiff };

export const REWRITTEN_NOTE =
  'This branch was force-pushed since your last look, so there is no telling what is new. Showing the full diff.';
export const UNREACHABLE_NOTE =
  'The changes since your last look could not be read; the branch may have been force-pushed. Showing the full diff.';

const FULL: DiffShown = { kind: 'full', note: null };
const READING: DiffShown = { kind: 'reading' };

export function diffShown(state: SinceLookState, wantsSince: boolean): DiffShown {
  if (!wantsSince) return FULL;
  switch (state.status) {
    case 'idle':
      return FULL;
    case 'reading':
      return READING;
    case 'unreachable':
      return { kind: 'full', note: UNREACHABLE_NOTE };
    case 'ready':
      return state.since.newCommits === null
        ? { kind: 'full', note: REWRITTEN_NOTE }
        : { kind: 'since', since: state.since };
  }
}

/** Whether the head moved past the one last looked at. */
export const hasMovedSince = (lookedSha: string | null, headSha: string): boolean =>
  lookedSha !== null && headSha !== '' && lookedSha !== headSha;
