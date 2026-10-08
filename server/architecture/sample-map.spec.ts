import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EDGE_KINDS,
  EDGE_MARKS,
  MAP_SCHEMA,
  MEMBER_KINDS,
  NODE_KINDS,
  NODE_MARKS,
  RUNTIME_KINDS,
} from './architecture-types.ts';
import { mapProblems } from './map-problems.ts';
import { SAMPLE_MAP } from './sample-map.ts';

const missing = (all: readonly string[], used: readonly string[]): string[] =>
  all.filter((each) => !used.includes(each));

describe('sample map', () => {
  it('is a sound map of the current schema', () => {
    assert.equal(SAMPLE_MAP.schema, MAP_SCHEMA);
    assert.deepEqual(mapProblems(SAMPLE_MAP), []);
  });

  it('uses every runtime, node, edge and member kind, and every mark', () => {
    const { runtimes, nodes, edges } = SAMPLE_MAP;
    const coverage: [readonly string[], readonly string[]][] = [
      [RUNTIME_KINDS, runtimes.map(({ kind }) => kind)],
      [NODE_KINDS, nodes.map(({ kind }) => kind)],
      [EDGE_KINDS, edges.map(({ kind }) => kind)],
      [MEMBER_KINDS, nodes.flatMap(({ members }) => members.map(({ kind }) => kind))],
      [NODE_MARKS, nodes.flatMap(({ marks }) => marks)],
      [EDGE_MARKS, edges.flatMap(({ marks }) => marks)],
    ];
    for (const [all, used] of coverage) assert.deepEqual(missing(all, used), []);
    assert.ok(
      nodes.some(({ parent }) => parent !== null),
      'a child node',
    );
  });
});

describe('map problems', () => {
  it('names an edge to nowhere and a count that disagrees with the edges', () => {
    const [first, ...rest] = SAMPLE_MAP.nodes;
    const [edge] = SAMPLE_MAP.edges;
    assert.ok(first && edge);
    const broken = {
      ...SAMPLE_MAP,
      nodes: [{ ...first, metrics: { ...first.metrics, fanOut: 99 } }, ...rest],
      edges: [...SAMPLE_MAP.edges, { ...edge, to: 'nowhere' }],
    };
    const problems = mapProblems(broken);
    assert.ok(problems.some((line) => line.includes('an end is not a node')));
    assert.ok(problems.some((line) => line.includes('fanOut 99')));
  });
});
