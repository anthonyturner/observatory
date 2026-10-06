import { SinceLookDiff } from '../../../../core/queue/since-look';
import { REWRITTEN_NOTE, UNREACHABLE_NOTE, diffShown, hasMovedSince } from './diff-shown';

const since: SinceLookDiff = {
  base: 'a'.repeat(40),
  head: 'b'.repeat(40),
  newCommits: 2,
  diff: 'diff --git a/x b/x',
  diffBytes: 18,
  diffTruncated: false,
  diffHidden: false,
};

describe('diffShown', () => {
  it('shows the whole diff when the changes since the last look are not wanted', () => {
    expect(diffShown({ status: 'ready', since }, false)).toEqual({ kind: 'full', note: null });
  });

  it('shows just the changes since the last look once they are read', () => {
    expect(diffShown({ status: 'reading' }, true)).toEqual({ kind: 'reading' });
    expect(diffShown({ status: 'ready', since }, true)).toEqual({ kind: 'since', since });
  });

  it('falls back to the whole diff with a note after a force-push', () => {
    expect(diffShown({ status: 'ready', since: { ...since, newCommits: null } }, true)).toEqual({
      kind: 'full',
      note: REWRITTEN_NOTE,
    });
  });

  it('falls back to the whole diff with a note when the changes cannot be read', () => {
    expect(diffShown({ status: 'unreachable' }, true)).toEqual({
      kind: 'full',
      note: UNREACHABLE_NOTE,
    });
  });
});

describe('hasMovedSince', () => {
  it('is true only for a head that moved past one looked at', () => {
    expect(hasMovedSince('a'.repeat(40), 'b'.repeat(40))).toBe(true);
    expect(hasMovedSince('a'.repeat(40), 'a'.repeat(40))).toBe(false);
    expect(hasMovedSince(null, 'b'.repeat(40))).toBe(false);
    expect(hasMovedSince('a'.repeat(40), '')).toBe(false);
  });
});
