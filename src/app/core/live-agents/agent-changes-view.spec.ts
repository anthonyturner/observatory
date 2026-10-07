import {
  agentChangesDiffKey,
  canRetry,
  committedOnlyText,
  comparedText,
  hasNoDiff,
  noChangesText,
  problemText,
  queuePathOf,
  untrackedNotes,
} from './agent-changes-view';
import { ChangesProblem } from './agent-changes.types';
import { agentChanges } from './testing/agent-changes-fixture';

const PROBLEMS: readonly ChangesProblem[] = [
  'no-folder',
  'folder-gone',
  'not-a-repo',
  'no-base',
  'git-failed',
  'timed-out',
];

describe('agent changes view', () => {
  it('gives every problem its own plain message, and offers a retry only where git may answer', () => {
    const texts = PROBLEMS.map(problemText);

    expect(new Set(texts).size).toBe(PROBLEMS.length);
    expect(problemText('not-a-repo')).toBe(
      "This agent's folder isn't in a git repository, so there are no changes to show.",
    );
    expect(problemText('no-base')).toContain('origin/HEAD, origin/main or origin/master');
    expect(problemText('timed-out')).toBe("Git took too long reading this folder's changes.");
    expect(PROBLEMS.filter(canRetry)).toEqual(['git-failed', 'timed-out']);
  });

  it('says what the diff is compared with, as of the last fetch', () => {
    expect(comparedText(agentChanges())).toBe('Compared with origin/main as of the last fetch.');
  });

  it('labels a gone folder’s committed changes, and where they were read', () => {
    const changes = agentChanges({ isCommittedOnly: true, readFrom: 'E:\\repos\\observatory' });

    expect(committedOnlyText(changes)).toBe(
      'This folder is gone, so only its committed changes show: feat/490-agents, read from E:\\repos\\observatory. Anything never committed went with it.',
    );
  });

  it('says there are no changes, or no others when files were left out', () => {
    const none = agentChanges({ diff: '', diffBytes: 0 });
    const onlyLarge = agentChanges({ diff: '', diffBytes: 0, skippedLarge: ['a.bin'] });
    const cutToNothing = agentChanges({ diff: '', diffTruncated: true });

    expect(hasNoDiff(none)).toBe(true);
    expect(noChangesText(none)).toBe('No changes yet against origin/main.');
    expect(noChangesText(onlyLarge)).toBe('No other changes against origin/main.');
    expect(hasNoDiff(cutToNothing)).toBe(false);
    expect(hasNoDiff(agentChanges())).toBe(false);
  });

  it('notes untracked files left out for their size or past the cap', () => {
    expect(untrackedNotes(agentChanges())).toEqual([]);
    expect(
      untrackedNotes(agentChanges({ skippedLarge: ['a.log', 'b.log'], untrackedOverCap: 1 })),
    ).toEqual([
      '2 untracked files over 256 KB not shown: a.log, b.log.',
      '1 untracked file past the first 200 not shown.',
    ]);
  });

  it('keys the viewed ticks by agent, and links the Review Queue', () => {
    expect(agentChangesDiffKey({ session: 's1', agentId: null })).toBe('agent:s1/session');
    expect(agentChangesDiffKey({ session: 's1', agentId: 'ab' })).toBe('agent:s1/ab');
    expect(queuePathOf('me/observatory')).toEqual(['/p', 'me', 'observatory']);
  });
});
