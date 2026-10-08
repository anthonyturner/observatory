import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SAMPLE_MAP } from '../../../server/architecture/sample-map.ts';
import { breadcrumbs } from './breadcrumbs.ts';
import { indexMap } from './map-index.ts';
import { nodeSelection } from './map-state.ts';

const index = indexMap(SAMPLE_MAP);
const PAGE = 'src/app/features/queue/queue-page.ts#QueuePage';
const ROW = 'src/app/features/queue/queue-row.ts#QueueRow';

const labels = (selection: Parameters<typeof breadcrumbs>[1]): string[] =>
  breadcrumbs(index, selection).map(({ label }) => label);

describe('breadcrumbs', () => {
  it('has no path when nothing is selected', () => {
    assert.deepEqual(labels(null), []);
  });

  it('runs runtime, area, parent, node for a child', () => {
    assert.deepEqual(labels(nodeSelection(ROW)), ['Browser app', 'Queue', 'QueuePage', 'QueueRow']);
  });

  it('skips the parent for a top-level node', () => {
    assert.deepEqual(labels(nodeSelection(PAGE)), ['Browser app', 'Queue', 'QueuePage']);
  });

  it('stops at the runtime or the area when one of those is selected', () => {
    assert.deepEqual(labels({ kind: 'runtime', id: 'server' }), ['API server']);
    assert.deepEqual(labels({ kind: 'area', id: 'server:github' }), ['API server', 'GitHub']);
  });

  it('selects the step that is chosen', () => {
    const crumbs = breadcrumbs(index, nodeSelection(ROW));
    assert.deepEqual(
      crumbs.map(({ selection }) => `${selection.kind}:${selection.id}`),
      ['runtime:browser', 'area:browser:features/queue', `node:${PAGE}`, `node:${ROW}`],
    );
  });

  it('gives no path for something the map does not hold', () => {
    assert.deepEqual(labels(nodeSelection('nowhere#Ghost')), []);
    assert.deepEqual(labels({ kind: 'area', id: 'ghost' }), []);
  });
});
