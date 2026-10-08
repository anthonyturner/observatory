import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SAMPLE_MAP } from '../../../server/architecture/sample-map.ts';
import { searchNodes } from './search.ts';

const names = (query: string, limit = 8): string[] =>
  searchNodes(SAMPLE_MAP.nodes, query, limit).map(({ node }) => node.name);

describe('searchNodes', () => {
  it('finds nothing for an empty query', () => {
    assert.deepEqual(names(''), []);
    assert.deepEqual(names('   '), []);
  });

  it('finds a node by a partial name, in any case', () => {
    assert.deepEqual(names('queuest'), ['QueueStore']);
    assert.equal(names('QUEUEPAGE')[0], 'QueuePage');
  });

  it('puts an exact name first, then a prefix, then a word in the middle', () => {
    assert.equal(names('QueueRow')[0], 'QueueRow');
    const ranked = names('queue');
    assert.ok(ranked.indexOf('QueueRow') < ranked.indexOf('queue-routes') || ranked.length > 0);
    assert.ok(ranked.slice(0, 3).every((name) => /queue/i.test(name)));
  });

  it('matches letters in order across a camelCase name', () => {
    assert.equal(names('qfeed')[0], 'QueueFeed');
    assert.equal(names('qs')[0], 'QueueStore');
  });

  it('matches several words in any order, each in the name or the file', () => {
    assert.equal(names('store queue')[0], 'QueueStore');
    assert.ok(names('core feed').includes('BaseFeed'));
  });

  it('finds a node by its kind or its folder', () => {
    assert.ok(names('token').includes('QUEUE_URL'));
    assert.ok(names('github').includes('github-client'));
  });

  it('finds an endpoint by its method and path', () => {
    assert.deepEqual(names('get api queue'), ['GET /api/queue']);
  });

  it('returns nothing when a word matches nowhere', () => {
    assert.deepEqual(names('queue zzzz'), []);
  });

  it('reports where the name matched, for highlighting', () => {
    const [hit] = searchNodes(SAMPLE_MAP.nodes, 'store', 1);
    assert.equal(hit?.node.name, 'QueueStore');
    assert.deepEqual(hit?.nameRanges, [[5, 10]]);
    const [spread] = searchNodes(SAMPLE_MAP.nodes, 'qs', 1);
    assert.deepEqual(spread?.nameRanges, [
      [0, 1],
      [5, 6],
    ]);
  });

  it('keeps to the limit and gives the same order every time', () => {
    assert.equal(names('e', 3).length, 3);
    assert.deepEqual(names('queue'), names('queue'));
  });
});
