import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fateReader, howMerged, PULL_STATE_QUERY, pullStateOf } from './fate-reader.ts';

const answer = (pull: object | null) => ({ repository: { pullRequest: pull } });

const stateOf = (pull: object) => pullStateOf(answer(pull)) ?? assert.fail('no state');

const merged = (parents: number, more: object = {}) => ({
  state: 'MERGED',
  title: 'feat: a thing',
  mergeCommit: { parents: { totalCount: parents } },
  closingIssuesReferences: { nodes: [{ number: 12 }, { number: 14 }] },
  reviewThreads: { nodes: [{ isResolved: true }, { isResolved: true }, { isResolved: false }] },
  ...more,
});

describe('pullStateOf', () => {
  it('reads a squash as one parent, with its threads and closing issues', () => {
    assert.deepEqual(stateOf(merged(1)), {
      state: 'MERGED',
      title: 'feat: a thing',
      ending: { how: 'squash', threads: { resolved: 2, unresolved: 1 }, closes: [12, 14] },
    });
  });

  it('reads a merge commit as two parents', () => {
    assert.equal(stateOf(merged(2)).ending?.how, 'merge');
  });

  it('reads a merged pull request with no merge commit to inspect as a squash', () => {
    assert.equal(stateOf(merged(0, { mergeCommit: null })).ending?.how, 'squash');
  });

  it('reads a closed pull request as closed, with no commit to look at', () => {
    const state = stateOf({
      state: 'CLOSED',
      title: 'x',
      mergeCommit: null,
      closingIssuesReferences: { nodes: [] },
      reviewThreads: { nodes: [] },
    });

    assert.deepEqual(state.ending, {
      how: 'closed',
      threads: { resolved: 0, unresolved: 0 },
      closes: [],
    });
  });

  it('gives an open pull request no ending', () => {
    assert.deepEqual(stateOf({ state: 'OPEN', title: 'wip', reviewThreads: { nodes: [] } }), {
      state: 'OPEN',
      title: 'wip',
    });
  });

  it('reads a pull request that is not there as none', () => {
    assert.equal(pullStateOf(answer(null)), null);
  });
});

describe('howMerged', () => {
  it('counts a rebase as a squash', () => {
    assert.deepEqual((['merge', 'squash', 'rebase'] as const).map(howMerged), [
      'merge',
      'squash',
      'squash',
    ]);
  });
});

describe('fateReader', () => {
  it('asks for the pull request by owner, name and number', async () => {
    const asked: unknown[] = [];
    const reader = fateReader(async (query, variables) => {
      asked.push(query, variables);
      return answer(merged(1));
    });

    const state = await reader.pullState('me/app', 7);

    assert.equal(state.ending?.how, 'squash');
    assert.deepEqual(asked, [PULL_STATE_QUERY, { owner: 'me', name: 'app', number: 7 }]);
  });

  it('refuses a pull request that is not there, naming it', async () => {
    const reader = fateReader(async () => answer(null));

    await assert.rejects(reader.pullState('me/app', 404), /me\/app has no pull request 404/);
  });
});
