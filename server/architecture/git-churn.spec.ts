import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { commitOn, fixtureProject, initGit, write } from './fixture-project.testing.ts';
import { gitChurn } from './git-churn.ts';

describe('gitChurn', () => {
  it('has no history for a folder that is not a git checkout', async () => {
    const churn = await gitChurn(fixtureProject({ 'a.ts': '' }), 90);
    assert.equal(churn.days, 0);
    assert.equal(churn.commitsByFile.size, 0);
  });

  it('has no history for a checkout with no commit yet', async () => {
    const root = fixtureProject({ 'a.ts': '' });
    initGit(root);
    assert.equal((await gitChurn(root, 90)).days, 0);
  });

  it('counts commits per file in the days before HEAD, not before now', async () => {
    const root = fixtureProject({ 'a.ts': '1', 'b.ts': '1' });
    initGit(root);
    commitOn(root, 'old', '2020-01-01T12:00:00Z');
    write(root, 'a.ts', '2');
    write(root, 'b.ts', '2');
    commitOn(root, 'recent one', '2020-06-01T12:00:00Z');
    write(root, 'a.ts', '3');
    commitOn(root, 'recent two', '2020-06-10T12:00:00Z');
    const churn = await gitChurn(root, 30);
    assert.equal(churn.days, 30);
    assert.deepEqual([...churn.commitsByFile].sort(), [
      ['a.ts', 2],
      ['b.ts', 1],
    ]);
  });

  it('names files relative to the folder it is given, inside a larger checkout', async () => {
    const root = fixtureProject({ 'app/src/a.ts': '1', 'other/b.ts': '1' });
    initGit(root);
    commitOn(root, 'all', '2020-06-01T12:00:00Z');
    const churn = await gitChurn(join(root, 'app'), 30);
    assert.deepEqual([...churn.commitsByFile], [['src/a.ts', 1]]);
  });
});
