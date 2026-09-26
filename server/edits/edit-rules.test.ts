import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EditChanges } from './edit-request.ts';
import { editProblems, safeChangesOf } from './edit-rules.ts';

const labels = new Set(['bug', 'area:ci']);
const problems = (changes: EditChanges) => editProblems(changes, labels);

describe('editProblems', () => {
  it('accepts what the page sends', () => {
    assert.deepEqual(
      problems({
        title: 'Fix it',
        body: 'Closes #1',
        addLabels: ['bug'],
        removeLabels: ['area:ci'],
        addAssignees: ['@me', 'sam-k'],
        removeReviewers: ['kim'],
        ready: true,
        merge: { method: 'squash', headOid: 'f'.repeat(40) },
      }),
      [],
    );
  });

  it('refuses an empty, long or broken title', () => {
    assert.deepEqual(problems({ title: '  ' }), ['title is empty']);
    assert.deepEqual(problems({ title: 'x'.repeat(257) }), ['title is over 256 characters']);
    assert.deepEqual(problems({ title: 'a\nb' }), ['title contains a line break']);
  });

  it('refuses a body over the limit', () => {
    assert.deepEqual(problems({ body: 'x'.repeat(65537) }), ['body is over 65536 characters']);
  });

  it('refuses a label that does not exist, so a typo never creates one', () => {
    assert.deepEqual(problems({ addLabels: ['bgu'] }), [
      'label "bgu" does not exist in this repository',
    ]);
  });

  it('refuses a name that is not a login', () => {
    assert.deepEqual(problems({ addReviewers: ['-rf', 'a b'] }), [
      '"-rf" is not a GitHub login',
      '"a b" is not a GitHub login',
    ]);
  });

  it('refuses a merge by another method, or not pinned to a full commit', () => {
    const merge = { method: 'fast-forward', headOid: 'abc1234' } as unknown as EditChanges['merge'];
    assert.deepEqual(problems({ merge }), [
      'merge method must be squash, merge or rebase',
      'merge is not pinned to the commit that was reviewed',
    ]);
  });
});

describe('safeChangesOf', () => {
  it('keeps the reversible changes, trims the title, and leaves the decisions out', () => {
    assert.deepEqual(
      safeChangesOf({
        title: ' T ',
        addLabels: [],
        removeLabels: ['bug'],
        ready: true,
        merge: { method: 'merge', headOid: 'f'.repeat(40) },
      }),
      { title: 'T', removeLabels: ['bug'] },
    );
  });
});
