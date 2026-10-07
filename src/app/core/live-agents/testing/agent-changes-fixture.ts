import { Observable, of } from 'rxjs';
import { AgentChangesApi } from '../agent-changes-api';
import { AgentChanges, AgentChangesState } from '../agent-changes.types';

export const ONE_FILE_DIFF = [
  'diff --git a/src/app.ts b/src/app.ts',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1 +1 @@',
  '-old',
  '+new',
  '',
].join('\n');

/** A worktree on a feature branch with one changed file, with any field replaced. */
export const agentChanges = (overrides: Partial<AgentChanges> = {}): AgentChanges => ({
  folder: 'E:\\repos\\observatory-wt-490',
  readFrom: 'E:/repos/observatory-wt-490',
  branch: 'feat/490-agents',
  base: 'origin/main',
  repo: 'me/observatory',
  isCommittedOnly: false,
  isSharedCheckout: false,
  diff: ONE_FILE_DIFF,
  diffBytes: ONE_FILE_DIFF.length,
  diffTruncated: false,
  skippedLarge: [],
  untrackedOverCap: 0,
  ...overrides,
});

/** An API that answers every read as a test sets it, and finds no open pull request by default. */
export function fakeAgentChangesApi(
  changes: () => Observable<AgentChangesState> = () =>
    of({ status: 'ready', changes: agentChanges() }),
  openPullOf: () => Observable<number | null> = () => of(null),
): AgentChangesApi {
  return { changes, openPullOf };
}
