import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { landedBaseOf } from './landed-base.ts';

const MERGED = [
  { number: 12, head: 'feat/12', base: 'main' },
  { number: 9, head: 'feat/9', base: 'main' },
];

describe('landedBaseOf', () => {
  it('names the merge that landed the branch a pull request is stacked on', () => {
    const landed = landedBaseOf({ number: 13, base: 'feat/12' }, [], MERGED);

    assert.deepEqual(landed, { number: 12, branch: 'feat/12', into: 'main' });
  });

  it('says nothing while an open pull request still heads the base', () => {
    const open = [{ number: 20, branch: 'feat/12' }];

    assert.equal(landedBaseOf({ number: 13, base: 'feat/12' }, open, MERGED), null);
  });

  it('says nothing for a base no merge came from, or an empty one', () => {
    assert.equal(landedBaseOf({ number: 13, base: 'main' }, [], MERGED), null);
    assert.equal(landedBaseOf({ number: 13, base: '' }, [], MERGED), null);
  });

  it('takes the newest merge of a reused branch name', () => {
    const merged = [{ number: 30, head: 'feat/x', base: 'release' }, ...MERGED];
    const older = [...MERGED, { number: 4, head: 'feat/x', base: 'main' }];

    assert.equal(landedBaseOf({ number: 31, base: 'feat/x' }, [], merged)?.into, 'release');
    assert.equal(landedBaseOf({ number: 31, base: 'feat/x' }, [], older)?.number, 4);
  });
});
