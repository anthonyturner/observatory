import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { keyScrubber } from './key-scrub.ts';

describe('keyScrubber', () => {
  it('blanks the key, any bearer value and anything shaped like an OpenRouter key', () => {
    const scrub = keyScrubber('secret-value');

    assert.equal(
      scrub('saw secret-value, Bearer abc.def and sk-or-v1-0123abc'),
      'saw [key], Bearer [key] and [key]',
    );
  });

  it('works with no key, and on what is not text', () => {
    const scrub = keyScrubber(null);

    assert.equal(scrub('bearer xyz'), 'Bearer [key]');
    assert.equal(scrub(undefined), '');
    assert.equal(scrub(401), '401');
  });
});
