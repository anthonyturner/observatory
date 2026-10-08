import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { secondDraftsIn } from './second-draft.ts';

const REVIEW = `## Self-review

All good, bar one thing.

## Second draft

- **First version:** The queue read every comment on every request.
- **Feedback:** The review saw a request per pull request, which a busy repository would feel.
- **Changed and why:** It pages the repository's comment list instead, so cost follows comments, not pulls.
- **Principles:** \`deep-modules\`, design-it-twice

## Verification

- build passes
`;

describe('secondDraftsIn', () => {
  it('reads the four labelled fields under the heading and stops at the next heading', () => {
    assert.deepEqual(secondDraftsIn(REVIEW), [
      {
        firstVersion: 'The queue read every comment on every request.',
        feedback:
          'The review saw a request per pull request, which a busy repository would feel.',
        change:
          "It pages the repository's comment list instead, so cost follows comments, not pulls.",
        principles: ['deep-modules', 'design-it-twice'],
      },
    ]);
  });

  it('reads one entry per First version line, and lines that carry on a field', () => {
    const drafts = secondDraftsIn(`### Second draft
First version: A flag argument.
It picked between two behaviours.
Feedback: Two functions would read better.
What changed and why: Split it in two.
Principles: decomposition

First version: A catch that swallowed the error.
Feedback: It hid a real failure.
Changed: It rethrows now.
Principle: defining-is-not-ignoring
`);

    assert.equal(drafts.length, 2);
    assert.equal(drafts[0].firstVersion, 'A flag argument.\nIt picked between two behaviours.');
    assert.deepEqual(drafts[1].principles, ['defining-is-not-ignoring']);
  });

  it('accepts bold around the label or the colon, and any case', () => {
    const [draft] = secondDraftsIn(`## SECOND DRAFT
**First version**: One.
__Feedback:__ Two.
* **changed and why:** Three.
- **Principles:** strategic-not-tactical
`);

    assert.deepEqual(draft, {
      firstVersion: 'One.',
      feedback: 'Two.',
      change: 'Three.',
      principles: ['strategic-not-tactical'],
    });
  });

  it('keeps only ids from the principles list, once each, and still keeps the lesson', () => {
    const [draft] = secondDraftsIn(`## Second draft
First version: A.
Feedback: B.
Changed and why: C.
Principles: deep-modules and deep-modules, not-a-principle, "shallow-modules".
`);

    assert.deepEqual(draft.principles, ['deep-modules', 'shallow-modules']);
    const [unnamed] = secondDraftsIn('## Second draft\nFirst version: A.\nFeedback: B.\nChanged: C.');
    assert.deepEqual(unnamed.principles, []);
  });

  it('leaves out an entry missing a field and reads comments without the section as none', () => {
    assert.deepEqual(
      secondDraftsIn('## Second draft\nFirst version: A.\nFeedback: B.\n'),
      [],
    );
    assert.deepEqual(secondDraftsIn('## Second draft\nNothing changed.'), []);
    assert.deepEqual(secondDraftsIn('## Self-review\nFirst version: A.\nFeedback: B.\nChanged: C.'), []);
    assert.deepEqual(secondDraftsIn(''), []);
  });

  it('does not read labels above the heading or under a later one', () => {
    const drafts = secondDraftsIn(`Feedback: stray.

## Second draft
First version: A.
Feedback: B.
Changed: C.

## Notes
First version: not part of it.
Feedback: nor this.
Changed: nor this.
`);

    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].change, 'C.');
  });

  it('reads Windows line endings', () => {
    const drafts = secondDraftsIn('## Second draft\r\nFirst version: A.\r\nFeedback: B.\r\nChanged: C.\r\n');
    assert.equal(drafts[0].feedback, 'B.');
  });
});
