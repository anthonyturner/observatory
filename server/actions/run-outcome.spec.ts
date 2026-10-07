import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ciHealthOf, outcomeOf, secondsBetween } from './run-outcome.ts';

describe('outcomeOf', () => {
  it('reads GitHub’s status and conclusion as one outcome', () => {
    assert.equal(outcomeOf('in_progress', null), 'running');
    assert.equal(outcomeOf('queued', null), 'queued');
    assert.equal(outcomeOf('waiting', null), 'queued');
    assert.equal(outcomeOf('completed', 'success'), 'passed');
    assert.equal(outcomeOf('completed', 'failure'), 'failed');
    assert.equal(outcomeOf('completed', 'timed_out'), 'failed');
    assert.equal(outcomeOf('completed', 'startup_failure'), 'failed');
    assert.equal(outcomeOf('completed', 'cancelled'), 'cancelled');
    assert.equal(outcomeOf('completed', 'action_required'), 'queued');
    assert.equal(outcomeOf('completed', 'skipped'), 'skipped');
    assert.equal(outcomeOf('completed', 'neutral'), 'skipped');
    assert.equal(outcomeOf('completed', null), 'skipped');
  });
});

describe('secondsBetween', () => {
  it('counts whole seconds, and none for a missing or backward pair', () => {
    assert.equal(secondsBetween('2026-10-07T10:00:00Z', '2026-10-07T10:03:12Z'), 192);
    assert.equal(secondsBetween(null, '2026-10-07T10:03:12Z'), null);
    assert.equal(secondsBetween('2026-10-07T10:03:12Z', '2026-10-07T10:00:00Z'), null);
  });
});

describe('ciHealthOf', () => {
  it('is failing when any workflow’s newest run failed, naming each', () => {
    const health = ciHealthOf('me/app', 'main', [
      { workflow: 'CI', outcome: 'failed' },
      { workflow: 'Deploy', outcome: 'passed' },
      { workflow: 'CI', outcome: 'passed' },
    ]);

    assert.deepEqual(health, { repo: 'me/app', branch: 'main', state: 'failing', failing: ['CI'] });
  });

  it('reads past a cancelled or skipped run to the one before it', () => {
    const health = ciHealthOf('me/app', 'main', [
      { workflow: 'CI', outcome: 'cancelled' },
      { workflow: 'CI', outcome: 'passed' },
    ]);

    assert.equal(health.state, 'passing');
  });

  it('is running while a newest run is going and none failed, and none with no runs', () => {
    const running = ciHealthOf('me/app', 'main', [
      { workflow: 'CI', outcome: 'running' },
      { workflow: 'CI', outcome: 'failed' },
      { workflow: 'Deploy', outcome: 'passed' },
    ]);

    assert.equal(running.state, 'running');
    assert.equal(ciHealthOf('me/app', 'main', []).state, 'none');
  });
});
