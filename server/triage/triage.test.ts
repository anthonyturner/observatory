import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequest } from '../http/api-handler.ts';
import { EMPTY_TRIAGE, applyTriage, triageOf, triageRequestFrom } from './triage.ts';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const DAY = 86_400_000;
const UPDATED = '2026-09-20T00:00:00Z';
const at = (now: number) => ({ now, updatedAt: UPDATED });
const HEAD_A = 'a'.repeat(40);
const HEAD_B = 'b'.repeat(40);

describe('triage', () => {
  it('marks a pull request seen, and unseen again', () => {
    const seen = applyTriage(EMPTY_TRIAGE, 7, 'seen', at(NOW));
    assert.equal(triageOf(seen, 7, UPDATED, NOW).isSeen, true);

    const unseen = applyTriage(seen, 7, 'unseen', at(NOW));
    assert.equal(triageOf(unseen, 7, UPDATED, NOW).isSeen, false);
  });

  it('hides a dismissed pull request until it changes', () => {
    const dismissed = applyTriage(EMPTY_TRIAGE, 7, 'dismiss', at(NOW));

    assert.deepEqual(triageOf(dismissed, 7, UPDATED, NOW).hidden, { reason: 'dismissed' });
    assert.equal(triageOf(dismissed, 7, '2026-09-27T00:00:00Z', NOW).hidden, null);
  });

  it('hides a snoozed pull request until the snooze ends', () => {
    const snoozed = applyTriage(EMPTY_TRIAGE, 7, 'snooze', { ...at(NOW), days: 7 });

    assert.equal(triageOf(snoozed, 7, UPDATED, NOW + DAY).hidden?.reason, 'snoozed');
    assert.equal(triageOf(snoozed, 7, UPDATED, NOW + 8 * DAY).hidden, null);
  });

  it('records the head a pull request was marked seen at', () => {
    const seen = applyTriage(EMPTY_TRIAGE, 7, 'seen', { ...at(NOW), headSha: HEAD_A });

    assert.equal(triageOf(seen, 7, UPDATED, NOW).lookedSha, HEAD_A);
    assert.equal(triageOf(seen, 8, UPDATED, NOW).lookedSha, null);
  });

  it('moves the recorded head on a look, without marking it seen or stamping a choice', () => {
    const seen = applyTriage(EMPTY_TRIAGE, 7, 'seen', { ...at(NOW), headSha: HEAD_A });
    const looked = applyTriage(seen, 7, 'look', { ...at(NOW + DAY), headSha: HEAD_B });
    const fresh = applyTriage(EMPTY_TRIAGE, 8, 'look', { ...at(NOW), headSha: HEAD_B });

    assert.equal(triageOf(looked, 7, UPDATED, NOW).lookedSha, HEAD_B);
    assert.equal(looked.changed['7'], seen.changed['7']);
    assert.equal(triageOf(fresh, 8, UPDATED, NOW).isSeen, false);
    assert.deepEqual(fresh.changed, {});
  });

  it('keeps the recorded head when a look or a seen mark carries none', () => {
    const looked = applyTriage(EMPTY_TRIAGE, 7, 'look', { ...at(NOW), headSha: HEAD_A });

    assert.equal(applyTriage(looked, 7, 'look', at(NOW)).looked['7'], HEAD_A);
    assert.equal(applyTriage(looked, 7, 'seen', at(NOW)).looked['7'], HEAD_A);
  });

  it('restores a dismissed or snoozed pull request, and leaves others alone', () => {
    let state = applyTriage(EMPTY_TRIAGE, 7, 'dismiss', at(NOW));
    state = applyTriage(state, 8, 'snooze', { ...at(NOW), days: 1 });
    state = applyTriage(state, 7, 'restore', at(NOW));

    assert.equal(triageOf(state, 7, UPDATED, NOW).hidden, null);
    assert.equal(triageOf(state, 8, UPDATED, NOW).hidden?.reason, 'snoozed');
  });
});

describe('triageRequestFrom', () => {
  it('reads a well-formed request', () => {
    assert.deepEqual(triageRequestFrom({ repo: 'me/a', number: 7, action: 'snooze', days: 7 }), {
      repo: 'me/a',
      number: 7,
      action: 'snooze',
      days: 7,
    });
  });

  it('reads the head a look names, in lower case', () => {
    assert.deepEqual(
      triageRequestFrom({ repo: 'me/a', number: 7, action: 'look', sha: 'ABC1234' }),
      {
        repo: 'me/a',
        number: 7,
        action: 'look',
        sha: 'abc1234',
      },
    );
  });

  it('refuses an unknown action, a bad repository, a bad number, or a bad snooze', () => {
    for (const bad of [
      null,
      { repo: 'me/a', number: 7, action: 'merge' },
      { repo: '../x', number: 7, action: 'seen' },
      { repo: 'me/a', number: '7', action: 'seen' },
      { repo: 'me/a', number: 7, action: 'snooze' },
      { repo: 'me/a', number: 7, action: 'snooze', days: 365 },
      { repo: 'me/a', number: 7, action: 'look', sha: '--force' },
      { repo: 'me/a', number: 7, action: 'look', sha: 7 },
    ]) {
      assert.throws(() => triageRequestFrom(bad), BadRequest, JSON.stringify(bad));
    }
  });
});
