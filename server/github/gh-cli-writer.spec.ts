import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { editFlagsOf } from './gh-cli-writer.ts';

describe('editFlagsOf', () => {
  it('gives each change as its own argument, never through a shell', () => {
    assert.deepEqual(
      editFlagsOf({
        title: 'Fix "it" `now`',
        addLabels: ['bug', 'area:ci'],
        removeLabels: [],
        addAssignees: ['@me'],
        removeReviewers: ['kim'],
      }),
      [
        '--title',
        'Fix "it" `now`',
        '--add-label',
        'bug,area:ci',
        '--add-assignee',
        '@me',
        '--remove-reviewer',
        'kim',
      ],
    );
  });

  it('leaves the body to its file', () => {
    assert.deepEqual(editFlagsOf({ body: 'long' }), []);
  });
});
