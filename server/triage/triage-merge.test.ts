import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMPTY_TRIAGE, applyTriage } from './triage.ts';
import { mergeTriage } from './triage-merge.ts';

const T1 = Date.parse('2026-09-20T00:00:00Z');
const T2 = Date.parse('2026-09-21T00:00:00Z');
const UPDATED = '2026-09-19T00:00:00Z';
const act = (now: number, days?: number) => ({ now, updatedAt: UPDATED, days });

describe('mergeTriage', () => {
  it('takes a snooze or a dismissal made on the other side', () => {
    const hosted = applyTriage(EMPTY_TRIAGE, 7, 'snooze', act(T1, 3));
    const withDismissal = applyTriage(hosted, 8, 'dismiss', act(T1));

    const merged = mergeTriage(EMPTY_TRIAGE, withDismissal);

    assert.equal(merged.snoozed['7'], '2026-09-23T00:00:00.000Z');
    assert.equal(merged.dismissed['8'], UPDATED);
  });

  it('lets the newer choice win for each pull request, a restore included', () => {
    const dismissedHere = applyTriage(EMPTY_TRIAGE, 7, 'dismiss', act(T1));
    const restoredThere = applyTriage(dismissedHere, 7, 'restore', act(T2));

    assert.equal(mergeTriage(dismissedHere, restoredThere).dismissed['7'], undefined);
    assert.equal(mergeTriage(restoredThere, dismissedHere).dismissed['7'], undefined);
  });

  it('keeps each side’s own pull requests, and ours on a tie or with no times', () => {
    const ours = { ...EMPTY_TRIAGE, seen: { '1': 'a', '3': 'mine' } };
    const theirs = applyTriage({ ...EMPTY_TRIAGE, seen: { '3': 'theirs' } }, 2, 'seen', act(T1));

    const merged = mergeTriage(ours, theirs);

    assert.deepEqual(merged.seen, {
      '1': 'a',
      '2': '2026-09-20T00:00:00.000Z',
      '3': 'mine',
    });
    assert.deepEqual(merged.changed, { '2': '2026-09-20T00:00:00.000Z' });
  });

  it('keeps the head looked at from the side that has one, the newer choice first', () => {
    const lookedHere = applyTriage(EMPTY_TRIAGE, 7, 'look', {
      ...act(T2),
      headSha: 'b'.repeat(40),
    });
    const seenThere = applyTriage(EMPTY_TRIAGE, 7, 'seen', { ...act(T1), headSha: 'a'.repeat(40) });
    const dismissedThere = applyTriage(EMPTY_TRIAGE, 7, 'dismiss', act(T1));

    assert.equal(mergeTriage(lookedHere, seenThere).looked['7'], 'a'.repeat(40));
    assert.equal(mergeTriage(lookedHere, dismissedThere).looked['7'], 'b'.repeat(40));
    assert.equal(mergeTriage(lookedHere, dismissedThere).dismissed['7'], UPDATED);
  });

  it('comes out the same whichever side merges', () => {
    const a = applyTriage(applyTriage(EMPTY_TRIAGE, 1, 'seen', act(T1)), 2, 'dismiss', act(T2));
    const b = applyTriage(applyTriage(EMPTY_TRIAGE, 1, 'unseen', act(T2)), 2, 'snooze', act(T1));

    assert.deepEqual(mergeTriage(a, b), mergeTriage(b, a));
  });
});
