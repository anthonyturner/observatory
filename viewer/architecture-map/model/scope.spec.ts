import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SAMPLE_MAP } from '../../../server/architecture/sample-map.ts';
import { indexMap } from './map-index.ts';
import { nodeSelection } from './map-state.ts';
import { groupSummary, scopeOf } from './scope.ts';

const index = indexMap(SAMPLE_MAP);
const PAGE = 'src/app/features/queue/queue-page.ts#QueuePage';
const ROW = 'src/app/features/queue/queue-row.ts#QueueRow';
const STORE = 'src/app/core/queue/queue-store.ts#QueueStore';
const FEED = 'src/app/core/queue/queue-feed.ts#QueueFeed';

describe('scopeOf', () => {
  it('has nothing to dim when nothing is selected', () => {
    assert.equal(scopeOf(index, null), null);
  });

  it('lights a node, what it links with, its parent and its children', () => {
    const page = scopeOf(index, nodeSelection(PAGE));
    assert.deepEqual(
      [...(page?.nodes ?? [])].sort(),
      [
        'src/app/core/queue/queue-store.ts#QueueStore',
        'src/app/features/queue/queue-page.ts#QueuePage',
        'src/app/features/queue/queue-row.ts#QueueRow',
        'src/app/core/queue/queue-handler.ts#QueueKeyHandler',
      ].sort(),
    );
    const row = scopeOf(index, nodeSelection(ROW));
    assert.equal(row?.nodes.has(PAGE), true);
  });

  it('lights only the edges that touch the selected node', () => {
    const scope = scopeOf(index, nodeSelection(STORE));
    const [touching, apart] = [
      SAMPLE_MAP.edges.find((e) => e.from === PAGE && e.to === STORE),
      SAMPLE_MAP.edges.find((e) => e.from === PAGE && e.to === ROW),
    ];
    assert.ok(touching && apart);
    assert.equal(scope?.lights(touching), true);
    assert.equal(scope?.lights(apart), false);
  });

  it('lights an area on its own: its nodes and the links between them', () => {
    const scope = scopeOf(index, { kind: 'area', id: 'browser:core/queue' });
    assert.equal(scope?.nodes.has(STORE), true);
    assert.equal(scope?.nodes.has(PAGE), false);
    const inside = SAMPLE_MAP.edges.find((e) => e.from === STORE && e.to === FEED);
    const leaving = SAMPLE_MAP.edges.find((e) => e.from === PAGE && e.to === STORE);
    assert.ok(inside && leaving);
    assert.equal(scope?.lights(inside), true);
    assert.equal(scope?.lights(leaving), false);
  });
});

describe('groupSummary', () => {
  it('counts the nodes of a runtime and how many carry each mark', () => {
    const summary = groupSummary(index, { kind: 'runtime', id: 'server' });
    assert.equal(summary.nodes, 4);
    assert.equal(summary.marked.get('hot'), 1);
    assert.equal(summary.marked.get('boundary'), 1);
    assert.equal(summary.marked.get('cycle'), undefined);
  });
});
