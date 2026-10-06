import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequest } from '../http/api-handler.ts';
import { editRequestFrom, editTargetFrom } from './edit-request.ts';

describe('editRequestFrom', () => {
  it('reads an edit in the shape the page sends it, and nothing else', () => {
    const merge = { method: 'squash', headOid: 'f'.repeat(40) };
    assert.deepEqual(
      editRequestFrom({
        repo: 'me/app',
        number: 7,
        changes: { title: 'T', addLabels: ['bug'], removeLabels: [], ready: true, merge, extra: 1 },
      }),
      {
        repo: 'me/app',
        number: 7,
        changes: { title: 'T', addLabels: ['bug'], ready: true, merge },
      },
    );
  });

  it('refuses a body that is not an edit', () => {
    const bad: unknown[] = [
      null,
      { repo: 'me/app', number: 7 },
      { repo: 'me/app', number: 7, changes: {} },
      { repo: 'me/app', number: 7, changes: { title: 3 } },
      { repo: 'me/app', number: 7, changes: { addLabels: 'bug' } },
      { repo: 'me/app', number: 7, changes: { merge: { method: 'squash' } } },
      { repo: '../x', number: 7, changes: { title: 'T' } },
      { repo: 'me/app', number: '7; rm', changes: { title: 'T' } },
    ];
    for (const body of bad) {
      assert.throws(() => editRequestFrom(body), BadRequest, JSON.stringify(body));
    }
  });
});

describe('editTargetFrom', () => {
  it('names a pull request by repository and number', () => {
    assert.deepEqual(editTargetFrom({ repo: 'me/app', number: '7' }), {
      repo: 'me/app',
      number: 7,
    });
  });
});
