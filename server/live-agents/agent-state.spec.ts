import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LISTED_MS, WORKING_MS, classify } from './agent-state.ts';

const NOW = Date.UTC(2026, 9, 7, 12, 0);
const MINUTE = 60_000;

const activity = (silentMs: number, more = {}) => ({
  lastWriteAt: NOW - silentMs,
  isTurnEnded: false,
  isFinished: false,
  ...more,
});

describe('classify', () => {
  it('is working while its last write is under two minutes old', () => {
    assert.deepEqual(classify(activity(WORKING_MS - 1), NOW), {
      state: 'working',
      quietMinutes: null,
    });
  });

  it('is quiet, with its minutes, from two minutes on', () => {
    assert.deepEqual(classify(activity(WORKING_MS), NOW), { state: 'quiet', quietMinutes: 2 });
    assert.deepEqual(classify(activity(14 * MINUTE + 59_000), NOW), {
      state: 'quiet',
      quietMinutes: 14,
    });
  });

  it('is waiting for you once its last reply ended the turn, however recent', () => {
    assert.equal(classify(activity(1_000, { isTurnEnded: true }), NOW).state, 'waiting');
    assert.equal(classify(activity(20 * MINUTE, { isTurnEnded: true }), NOW).state, 'waiting');
  });

  it('stops running after thirty silent minutes, or once it has finished', () => {
    assert.equal(classify(activity(LISTED_MS), NOW).state, 'quiet');
    assert.equal(classify(activity(LISTED_MS + 1), NOW).state, 'not-running');
    assert.equal(classify(activity(1_000, { isFinished: true }), NOW).state, 'not-running');
  });
});
