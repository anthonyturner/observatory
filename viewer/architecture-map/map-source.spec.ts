import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SAMPLE_MAP } from '../../server/architecture/sample-map.ts';
import { readMap } from './map-source.ts';

describe('readMap', () => {
  it('reads a map written by the scanner', () => {
    assert.deepEqual(readMap(JSON.stringify(SAMPLE_MAP)), SAMPLE_MAP);
  });

  it('says plainly when the page carries no map', () => {
    assert.throws(() => readMap(null), /carries no architecture map/);
    assert.throws(() => readMap(''), /carries no architecture map/);
  });

  it('asks for a new scan when the map is of another schema', () => {
    assert.throws(
      () => readMap(JSON.stringify({ ...SAMPLE_MAP, schema: 2 })),
      /not schema 3 \(it says 2\).*arch:scan/,
    );
  });

  it('refuses something that is not a map at all', () => {
    assert.throws(() => readMap('[1, 2]'), /not schema 3 \(it says undefined\)/);
    assert.throws(
      () => readMap(JSON.stringify({ schema: 3, nodes: [] })),
      /missing runtimes, areas, edges, cycles/,
    );
  });
});
