import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequest } from '../http/api-server.ts';
import { EMPTY_TRIAGE, applyTriage, triageOf, triageRequestFrom } from './triage.ts';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const DAY = 86_400_000;
const UPDATED = '2026-09-20T00:00:00Z';
const at = (now: number) => ({ now, updatedAt: UPDATED });

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

  it('refuses an unknown action, a bad repository, a bad number, or a bad snooze', () => {
    for (const bad of [
      null,
      { repo: 'me/a', number: 7, action: 'merge' },
      { repo: '../x', number: 7, action: 'seen' },
      { repo: 'me/a', number: '7', action: 'seen' },
      { repo: 'me/a', number: 7, action: 'snooze' },
      { repo: 'me/a', number: 7, action: 'snooze', days: 365 },
    ]) {
      assert.throws(() => triageRequestFrom(bad), BadRequest, JSON.stringify(bad));
    }
  });
});
