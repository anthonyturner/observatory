import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planSync } from './wiki-plan.ts';

const OURS = '<!-- docs-wiki-sync: generated from x; edit it there -->\nold';
const generated = new Map([
  ['Home', '<!-- docs-wiki-sync: new home -->'],
  ['Tech-stack', '<!-- docs-wiki-sync: new stack -->'],
]);

describe('planSync', () => {
  it('writes every page into an empty folder', () => {
    const plan = planSync(new Map(), generated);

    assert.deepEqual([...plan.write.keys()], ['Home', 'Tech-stack']);
    assert.deepEqual(plan.remove, []);
    assert.deepEqual(plan.kept, []);
  });

  it('replaces its own pages, removes the ones it no longer publishes, and leaves hand-written ones', () => {
    const current = new Map([
      ['Home', OURS],
      ['Tech-stack', OURS],
      ['Old-page', OURS],
      ['Notes', 'Written by hand'],
    ]);

    const plan = planSync(current, generated);

    assert.deepEqual([...plan.write.keys()], ['Home', 'Tech-stack']);
    assert.deepEqual(plan.remove, ['Old-page']);
  });

  it('keeps a hand-written page that shares a name with one it publishes', () => {
    const plan = planSync(
      new Map([
        ['Home', OURS],
        ['Tech-stack', 'Written by hand'],
      ]),
      generated,
    );

    assert.deepEqual([...plan.write.keys()], ['Home']);
    assert.deepEqual(plan.kept, ['Tech-stack']);
  });

  it('takes over the Home page saved to create the wiki on the first sync only', () => {
    const first = planSync(new Map([['Home', 'Welcome to the app wiki!']]), generated);
    const later = planSync(
      new Map([
        ['Home', 'Rewritten by hand'],
        ['Tech-stack', OURS],
      ]),
      generated,
    );

    assert.deepEqual([...first.write.keys()], ['Home', 'Tech-stack']);
    assert.deepEqual(later.kept, ['Home']);
  });
});
