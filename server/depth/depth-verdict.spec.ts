import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PRINCIPLES } from '../principles/principles.ts';
import { DEEP_FROM, VERDICTS, judgeDepth } from './depth-verdict.ts';

describe('judgeDepth', () => {
  it('is deep when the work is many times what a caller learns', () => {
    const judged = judgeDepth({ implementation: 80, interfaceSize: 4 });

    assert.deepEqual(judged, { depth: 20, verdict: 'deep', principle: 'deep-modules' });
  });

  it('is shallow when a caller learns more than the module does for them', () => {
    const judged = judgeDepth({ implementation: 1, interfaceSize: 2 });

    assert.deepEqual(judged, { depth: 0.5, verdict: 'shallow', principle: 'shallow-modules' });
  });

  it('is balanced between, and still asks whether it could hide more', () => {
    const judged = judgeDepth({ implementation: 12, interfaceSize: 4 });

    assert.deepEqual(judged, { depth: 3, verdict: 'balanced', principle: 'deep-modules' });
  });

  it('draws the line at exactly the deep ratio', () => {
    assert.equal(judgeDepth({ implementation: DEEP_FROM, interfaceSize: 1 }).verdict, 'deep');
    assert.equal(
      judgeDepth({ implementation: DEEP_FROM - 1, interfaceSize: 1 }).verdict,
      'balanced',
    );
  });

  it('does not call a one-name interface shallow: there is nothing to wrap', () => {
    assert.equal(judgeDepth({ implementation: 0, interfaceSize: 1 }).verdict, 'balanced');
  });

  it('reads an empty interface as one thing to learn rather than dividing by zero', () => {
    assert.equal(judgeDepth({ implementation: 5, interfaceSize: 0 }).depth, 5);
  });

  it('rounds the depth to two places', () => {
    assert.equal(judgeDepth({ implementation: 10, interfaceSize: 3 }).depth, 3.33);
  });
});

describe('the principles a verdict names', () => {
  it('exist in the principles deck, so the screen can show their words', () => {
    const ids = new Set(PRINCIPLES.map(({ id }) => id));

    for (const verdict of VERDICTS) {
      const sample = { deep: [80, 1], balanced: [4, 2], shallow: [0, 3] }[verdict];
      const { principle } = judgeDepth({ implementation: sample[0], interfaceSize: sample[1] });
      assert.ok(ids.has(principle), `${verdict} names ${principle}`);
    }
  });
});
