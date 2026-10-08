import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import type { ElkNode } from 'elkjs/lib/elk-api';
import ELK from 'elkjs/lib/elk.bundled.js';
import { SAMPLE_MAP } from '../../../../server/architecture/sample-map.ts';
import { indexMap } from '../../model/map-index.ts';
import { initialState, setLevel, type ZoomLevel } from '../../model/map-state.ts';
import { syntheticMap } from '../../testing/synthetic-map.ts';
import {
  layoutBoard,
  placeLayout,
  toElkGraph,
  type Box,
  type BoardLayout,
} from './board-layout.ts';
import { buildBoard, type Board } from './board-model.ts';
import { standInWorkerFactory } from './elk-stand-in.ts';

const elk = new ELK();
const run = (graph: ElkNode): Promise<ElkNode> => elk.layout(graph);

const boardOf = (map = SAMPLE_MAP, level: ZoomLevel = 'classes'): Board => {
  const index = indexMap(map);
  return buildBoard(index, setLevel(initialState(index, 'circuit'), index, level));
};

const inside = (inner: Box, outer: Box): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Every rule a drawn board must keep, whatever the map: nesting, no overlaps, and straight right-angled traces. */
function assertSoundLayout(board: Board, layout: BoardLayout): void {
  for (const rig of board.rigs) {
    const rigBox = layout.boxes.get(rig.id);
    assert.ok(rigBox, `no box for ${rig.id}`);
    for (const bay of rig.bays) {
      const bayBox = layout.boxes.get(bay.id);
      assert.ok(bayBox && inside(bayBox, rigBox), `${bay.id} is not inside ${rig.id}`);
      const chipBoxes = bay.chips.map((chip) => {
        const box = layout.boxes.get(chip.id);
        assert.ok(box && inside(box, bayBox), `${chip.id} is not inside ${bay.id}`);
        return box;
      });
      chipBoxes.forEach((a, at) =>
        chipBoxes
          .slice(at + 1)
          .forEach((b) => assert.equal(overlap(a, b), false, `chips overlap in ${bay.id}`)),
      );
    }
  }
  for (const trace of board.traces) {
    const route = layout.routes.get(trace.id) ?? [];
    assert.ok(route.length >= 2, `${trace.id} has no route`);
    route.slice(1).forEach((to, at) => {
      const from = route[at];
      assert.ok(
        from && (Math.abs(from.x - to.x) < 0.01 || Math.abs(from.y - to.y) < 0.01),
        `${trace.id} is not right-angled`,
      );
    });
  }
}

describe('toElkGraph', () => {
  const graph = toElkGraph(boardOf());

  it('nests rigs, bays and chips as the board does, with every trace as an edge', () => {
    assert.deepEqual(
      graph.children?.map((rig) => [rig.id, rig.children?.length]),
      [
        ['rig:browser', 3],
        ['rig:server', 3],
        ['rig:web', 1],
        ['rig:programs', 1],
      ],
    );
    const bay = graph.children?.[0]?.children?.find((each) => each.id === 'bay:browser:core/queue');
    assert.equal(bay?.children?.length, 6);
    assert.equal(graph.edges?.length, SAMPLE_MAP.edges.length - 1);
  });

  it('gives every chip its size, and a closed bay its own', () => {
    const chip = graph.children?.[0]?.children?.[0]?.children?.[0];
    assert.ok((chip?.width ?? 0) > 0 && (chip?.height ?? 0) > 0);
    const closed = toElkGraph(boardOf(SAMPLE_MAP, 'areas')).children?.[0]?.children?.[0];
    assert.equal(closed?.children, undefined);
    assert.ok((closed?.width ?? 0) > 0);
  });

  it('asks for right-angled routes across the whole hierarchy', () => {
    assert.equal(graph.layoutOptions?.['elk.edgeRouting'], 'ORTHOGONAL');
    assert.equal(graph.layoutOptions?.['elk.hierarchyHandling'], 'INCLUDE_CHILDREN');
  });
});

describe('placeLayout', () => {
  it('adds up the offsets of every container to give board positions', () => {
    const laidOut: ElkNode = {
      id: 'board',
      x: 0,
      y: 0,
      width: 500,
      height: 300,
      children: [
        {
          id: 'rig',
          x: 10,
          y: 20,
          width: 400,
          height: 200,
          children: [{ id: 'chip', x: 5, y: 6, width: 50, height: 40 }],
        },
      ],
      edges: [
        {
          id: 'in-rig',
          container: 'rig',
          sources: ['a'],
          targets: ['b'],
          sections: [
            {
              id: 's',
              startPoint: { x: 1, y: 2 },
              endPoint: { x: 11, y: 2 },
              bendPoints: [{ x: 6, y: 2 }],
            },
          ],
        },
        {
          id: 'at-root',
          sources: ['a'],
          targets: ['b'],
          sections: [{ id: 't', startPoint: { x: 100, y: 100 }, endPoint: { x: 200, y: 100 } }],
        },
      ],
    };
    const layout = placeLayout(laidOut);
    assert.deepEqual(layout.boxes.get('chip'), { x: 15, y: 26, width: 50, height: 40 });
    assert.deepEqual(layout.routes.get('in-rig'), [
      { x: 11, y: 22 },
      { x: 16, y: 22 },
      { x: 21, y: 22 },
    ]);
    assert.deepEqual(layout.routes.get('at-root'), [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);
    assert.deepEqual([layout.width, layout.height], [500, 300]);
  });
});

describe('layoutBoard with ELK', () => {
  for (const level of ['areas', 'classes', 'members'] as const) {
    it(`lays out the sample map soundly at the ${level} level`, async () => {
      const board = boardOf(SAMPLE_MAP, level);
      assertSoundLayout(board, await layoutBoard(board, run));
    });
  }

  it('gives the same layout through the stand-in worker the page falls back to', async () => {
    const source = await readFile(
      new URL(import.meta.resolve('elkjs/lib/elk-worker.min.js')),
      'utf8',
    );
    const fallback = new ELK({ workerFactory: standInWorkerFactory(source) });
    const board = boardOf();
    const viaFallback = placeLayout(await fallback.layout(toElkGraph(board)));
    const direct = await layoutBoard(board, run);
    assert.deepEqual([...viaFallback.boxes], [...direct.boxes]);
  });
});

describe('a large synthetic map', () => {
  const map = syntheticMap({ nodes: 400, edges: 1200, seed: 7 });

  for (const level of ['areas', 'classes'] as const) {
    it(`is laid out soundly at the ${level} level`, { timeout: 180_000 }, async (context) => {
      const board = boardOf(map, level);
      const started = performance.now();
      const layout = await layoutBoard(board, run);
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      context.diagnostic(
        `${level}: ${board.traces.length} traces laid out in ${seconds} s, ${Math.round(layout.width)} x ${Math.round(layout.height)}`,
      );
      assertSoundLayout(board, layout);
    });
  }
});
