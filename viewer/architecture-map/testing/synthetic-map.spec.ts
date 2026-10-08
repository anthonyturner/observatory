import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapProblems } from '../../../server/architecture/map-problems.ts';
import { syntheticMap } from './synthetic-map.ts';

describe('syntheticMap', () => {
  const map = syntheticMap({ nodes: 400, edges: 1200, seed: 7 });

  it('obeys the contract the views rely on', () => {
    assert.deepEqual(mapProblems(map), []);
  });

  it('has about the size asked for', () => {
    assert.equal(map.nodes.length, 400);
    assert.ok(map.edges.length >= 1100 && map.edges.length <= 1300, `${map.edges.length} edges`);
  });

  it('uses every runtime, a spread of areas, and the marks the views draw', () => {
    assert.equal(new Set(map.nodes.map(({ area }) => area)).size, map.areas.length);
    for (const mark of ['hub', 'cycle', 'unused', 'boundary', 'hot'] as const) {
      assert.ok(
        map.nodes.some(({ marks }) => marks.includes(mark)),
        `no node marked ${mark}`,
      );
    }
    assert.ok(map.nodes.some(({ parent }) => parent !== null));
  });

  it('is the same map every time for one seed, and a different one for another', () => {
    assert.deepEqual(syntheticMap({ nodes: 400, edges: 1200, seed: 7 }), map);
    assert.notDeepEqual(syntheticMap({ nodes: 400, edges: 1200, seed: 8 }), map);
  });
});
