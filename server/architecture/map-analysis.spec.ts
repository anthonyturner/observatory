import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ArchitectureEdge, ArchitectureNode, EdgeKind } from './architecture-types.ts';
import { type AnalysisInputs, analyse } from './map-analysis.ts';
import { newNode } from './map-nodes.ts';

const node = (
  id: string,
  extra: Partial<ArchitectureNode> = {},
  area = 'browser:core',
): ArchitectureNode =>
  newNode({ id, name: id, kind: 'service', file: `${id}.ts`, area, group: '', ...extra });

const edge = (from: string, to: string, kind: EdgeKind = 'injects'): ArchitectureEdge => ({
  from,
  to,
  kind,
  how: null,
  members: [],
  marks: [],
});

const run = (
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[],
  extra: Partial<AnalysisInputs> = {},
) =>
  analyse({
    nodes,
    edges,
    entryIds: new Set(),
    runtimeOfArea: new Map([
      ['browser:core', 'browser'],
      ['server:app', 'server'],
      ['web-service', 'web-service'],
    ]),
    cycleFilePairs: new Set(),
    cycleIds: new Set(),
    ...extra,
  });

const marksOf = (result: ReturnType<typeof run>, id: string) =>
  result.nodes.find((each) => each.id === id)?.marks;

describe('analyse: counts', () => {
  it('counts code edges in and out, and leaves flow edges out', () => {
    const { nodes } = run(
      [node('a'), node('b'), node('route', { kind: 'route' })],
      [edge('a', 'b'), edge('a', 'b', 'calls'), edge('a', 'route', 'requests')],
    );
    assert.deepEqual(
      nodes.map(({ id, metrics }) => [id, metrics.fanIn, metrics.fanOut]),
      [
        ['a', 0, 2],
        ['b', 2, 0],
        ['route', 0, 0],
      ],
    );
  });
});

describe('analyse: unused', () => {
  const nodes = [
    node('orphan'),
    node('used'),
    node('routed'),
    node('entry'),
    node('handler'),
    node('route', { kind: 'route' }),
    node('service', { kind: 'external', area: 'web-service' }, 'web-service'),
  ];
  const result = run(
    nodes,
    [edge('route', 'handler', 'handles'), edge('entry', 'used'), edge('routed', 'used')],
    { entryIds: new Set(['routed', 'entry']) },
  );

  it('marks what nothing depends on and nothing starts', () => {
    assert.deepEqual(marksOf(result, 'orphan'), ['unused']);
  });

  it('spares what is depended on, routed, an entry, a route’s code, a route or an outside service', () => {
    for (const id of ['used', 'routed', 'entry', 'handler', 'route', 'service']) {
      assert.deepEqual(marksOf(result, id), [], id);
    }
  });
});

describe('analyse: hubs and hot files', () => {
  const spokes = Array.from({ length: 9 }, (_, at) => node(`spoke-${at}`));

  it('marks a node with at least 8 code edges that is also among the busiest', () => {
    const hub = node('hub');
    const result = run(
      [hub, ...spokes],
      spokes.map(({ id }) => edge(id, 'hub')),
    );
    assert.deepEqual(marksOf(result, 'hub'), ['hub']);
    assert.deepEqual(marksOf(result, 'spoke-0'), ['unused']);
  });

  it('marks no hub in a map where no node has 8 code edges', () => {
    const hub = node('hub');
    const result = run(
      [hub, ...spokes.slice(0, 7)],
      spokes.slice(0, 7).map(({ id }) => edge(id, 'hub')),
    );
    assert.ok(result.nodes.every(({ marks }) => !marks.includes('hub')));
  });

  it('marks the most changed files, but none that changed fewer than 5 times', () => {
    const churned = (id: string, churn: number) =>
      node(id, { metrics: { fanIn: 0, fanOut: 0, churn } });
    const busy = run([churned('busy', 40), churned('calm', 4), churned('quiet', 0)], []);
    assert.deepEqual(marksOf(busy, 'busy')?.includes('hot'), true);
    assert.deepEqual(marksOf(busy, 'calm')?.includes('hot'), false);
    const calm = run([churned('a', 4), churned('b', 3)], []);
    assert.ok(calm.nodes.every(({ marks }) => !marks.includes('hot')));
  });
});

describe('analyse: boundaries and cycles', () => {
  const result = run(
    [
      node('page'),
      node('shared', {}, 'server:app'),
      node('server-side', {}, 'server:app'),
      node('ring-a', { file: 'a.ts' }),
      node('ring-b', { file: 'b.ts' }),
    ],
    [
      edge('page', 'shared', 'imports'),
      edge('shared', 'server-side', 'imports'),
      edge('page', 'shared', 'requests'),
      edge('ring-a', 'ring-b', 'imports'),
    ],
    { cycleFilePairs: new Set(['a.ts>b.ts']), cycleIds: new Set(['ring-a', 'ring-b']) },
  );

  it('marks a code edge between two runtimes, and both its ends', () => {
    const crossing = result.edges.find((each) => each.from === 'page' && each.kind === 'imports');
    assert.deepEqual(crossing?.marks, ['boundary']);
    assert.deepEqual(marksOf(result, 'page')?.includes('boundary'), true);
    assert.deepEqual(marksOf(result, 'shared')?.includes('boundary'), true);
    assert.deepEqual(marksOf(result, 'server-side')?.includes('boundary'), false);
  });

  it('does not count a flow edge as crossing a boundary', () => {
    const flow = result.edges.find((each) => each.kind === 'requests');
    assert.deepEqual(flow?.marks, []);
  });

  it('marks the edges and the nodes on a cycle', () => {
    const ring = result.edges.find((each) => each.from === 'ring-a');
    assert.deepEqual(ring?.marks, ['cycle']);
    assert.deepEqual(marksOf(result, 'ring-a')?.includes('cycle'), true);
  });
});
