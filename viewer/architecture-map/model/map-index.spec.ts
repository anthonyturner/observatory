import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  ArchitectureMap,
  ArchitectureNode,
} from '../../../server/architecture/architecture-types.ts';
import { SAMPLE_MAP } from '../../../server/architecture/sample-map.ts';
import { drawnAreaOf, indexMap, nodesOfArea, nodesOfRuntime } from './map-index.ts';

const PAGE = 'src/app/features/queue/queue-page.ts#QueuePage';
const ROW = 'src/app/features/queue/queue-row.ts#QueueRow';

const withNodes = (nodes: readonly ArchitectureNode[]): ArchitectureMap => ({
  ...SAMPLE_MAP,
  nodes,
});

const find = (id: string): ArchitectureNode => {
  const node = SAMPLE_MAP.nodes.find((each) => each.id === id);
  assert.ok(node, `${id} is in the sample`);
  return node;
};

describe('indexMap', () => {
  const index = indexMap(SAMPLE_MAP);

  it('draws a child inside the chip of its parent', () => {
    assert.equal(index.chipOf.get(ROW), PAGE);
    assert.equal(index.chipOf.get(PAGE), PAGE);
    assert.deepEqual(
      index.daughtersOf.get(PAGE)?.map(({ name }) => name),
      ['QueueRow'],
    );
  });

  it('lists only top-level nodes as the chips of an area', () => {
    const names = index.chipsOfArea.get('browser:features/queue')?.map(({ name }) => name);
    assert.deepEqual(names, ['OldBanner', 'QueuePage']);
  });

  it('finds the area that draws a child, even one scanned into another area', () => {
    const elsewhere = { ...find(ROW), area: 'browser:core/feed' };
    const moved = indexMap(withNodes(SAMPLE_MAP.nodes.map((n) => (n.id === ROW ? elsewhere : n))));
    assert.equal(drawnAreaOf(moved, ROW), 'browser:features/queue');
    assert.equal(drawnAreaOf(index, 'missing'), undefined);
  });

  it('keeps edges by both ends', () => {
    assert.equal(index.edgesOut.get(PAGE)?.length, 2);
    assert.equal(index.edgesIn.get(ROW)?.length, 1);
  });

  it('treats a parent that is missing as no parent, and draws parents that loop one by one', () => {
    const orphan = { ...find(ROW), parent: 'nowhere#Ghost' };
    const missing = indexMap(withNodes(SAMPLE_MAP.nodes.map((n) => (n.id === ROW ? orphan : n))));
    assert.equal(missing.chipOf.get(ROW), ROW);

    const loop = { ...find(PAGE), parent: ROW };
    const looped = indexMap(withNodes(SAMPLE_MAP.nodes.map((n) => (n.id === PAGE ? loop : n))));
    assert.equal(looped.chipOf.get(ROW), ROW);
    assert.equal(looped.chipOf.get(PAGE), PAGE);
  });

  it('gathers the nodes of an area and of a runtime', () => {
    assert.equal(nodesOfArea(index, 'browser:core/queue').length, 6);
    assert.equal(nodesOfRuntime(index, 'server').length, 4);
  });
});
