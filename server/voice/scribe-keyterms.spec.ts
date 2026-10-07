import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_KEYTERMS, scribeKeyterms } from './scribe-keyterms.ts';

describe('scribeKeyterms', () => {
  it('keeps terms Scribe takes, in order, tidied', () => {
    assert.deepEqual(scribeKeyterms(['Jev', '  pull   request ', 'PR 412']), [
      'Jev',
      'pull request',
      'PR 412',
    ]);
  });

  it('drops blank terms, and those of 50 characters or more', () => {
    assert.deepEqual(scribeKeyterms(['', '   ', 'x'.repeat(50), 'x'.repeat(49)]), ['x'.repeat(49)]);
  });

  it('drops terms of more than five words', () => {
    assert.deepEqual(scribeKeyterms(['one two three four five', 'one two three four five six']), [
      'one two three four five',
    ]);
  });

  it('drops terms with characters Scribe does not support', () => {
    const unsupported = ['a<b', 'a>b', 'a{b', 'a}b', 'a[b', 'a]b', 'a\\b'];
    assert.deepEqual(scribeKeyterms([...unsupported, 'pr-starmap']), ['pr-starmap']);
  });

  it('keeps the first 100, so a short recording is not billed as 20 seconds', () => {
    const many = Array.from({ length: 150 }, (_, i) => `PR ${i}`);
    const kept = scribeKeyterms(many);
    assert.equal(kept.length, MAX_KEYTERMS);
    assert.equal(kept[0], 'PR 0');
    assert.equal(kept.at(-1), 'PR 99');
  });
});
