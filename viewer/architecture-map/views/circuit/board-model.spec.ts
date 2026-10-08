import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ArchitectureMap } from '../../../../server/architecture/architecture-types.ts';
import { SAMPLE_MAP } from '../../../../server/architecture/sample-map.ts';
import { indexMap } from '../../model/map-index.ts';
import { initialState, setLevel, toggleArea, type ZoomLevel } from '../../model/map-state.ts';
import { buildBoard, chipId, bayId } from './board-model.ts';

const PAGE = 'src/app/features/queue/queue-page.ts#QueuePage';
const ROW = 'src/app/features/queue/queue-row.ts#QueueRow';
const STORE = 'src/app/core/queue/queue-store.ts#QueueStore';
const FEED = 'src/app/core/queue/queue-feed.ts#QueueFeed';
const GITHUB_CLIENT = 'server/github/github-client.ts';

const boardAt = (level: ZoomLevel, map: ArchitectureMap = SAMPLE_MAP) => {
  const index = indexMap(map);
  const state = setLevel(initialState(index, 'circuit'), index, level);
  return buildBoard(index, state);
};

const chipsOf = (board: ReturnType<typeof boardAt>): string[] =>
  board.rigs.flatMap((rig) => rig.bays.flatMap((bay) => bay.chips.map(({ node }) => node.name)));

describe('buildBoard', () => {
  it('draws a rig for each runtime and a bay for each area that holds something', () => {
    const board = boardAt('classes');
    assert.deepEqual(
      board.rigs.map((rig) => [rig.runtime.id, rig.bays.length]),
      [
        ['browser', 3],
        ['server', 3],
        ['web', 1],
        ['programs', 1],
      ],
    );
  });

  it('leaves out a rig whose areas hold nothing', () => {
    const empty: ArchitectureMap = {
      ...SAMPLE_MAP,
      nodes: SAMPLE_MAP.nodes.filter((n) => n.area !== 'web'),
    };
    assert.equal(
      boardAt('classes', empty).rigs.some((rig) => rig.runtime.id === 'web'),
      false,
    );
  });

  it('draws a chip for each top-level node and a daughter inside the chip of its parent', () => {
    const board = boardAt('classes');
    const names = chipsOf(board);
    assert.equal(names.length, SAMPLE_MAP.nodes.length - 1);
    assert.equal(names.includes('QueueRow'), false);
    const page = board.rigs[0]?.bays
      .flatMap((bay) => bay.chips)
      .find(({ node }) => node.id === PAGE);
    assert.deepEqual(
      page?.size.daughters.map(({ node }) => node.name),
      ['QueueRow'],
    );
  });

  it('closes every bay at the areas level, with no chips', () => {
    const board = boardAt('areas');
    const bays = board.rigs.flatMap((rig) => rig.bays);
    assert.equal(
      bays.every((bay) => bay.collapsed && bay.chips.length === 0),
      true,
    );
    assert.equal(bays.find((bay) => bay.area.id === 'browser:features/queue')?.classes, 3);
  });

  it('sizes a chip taller at the members level, to list its members', () => {
    const height = (level: ZoomLevel): number | undefined =>
      boardAt(level)
        .rigs[0]?.bays.flatMap((bay) => bay.chips)
        .find(({ node }) => node.id === STORE)?.size.height;
    assert.ok((height('members') ?? 0) > (height('classes') ?? 0));
  });

  it('opens one bay against the level, and leaves the rest', () => {
    const index = indexMap(SAMPLE_MAP);
    const closed = setLevel(initialState(index, 'circuit'), index, 'areas');
    const board = buildBoard(index, toggleArea(closed, 'browser:core/queue'));
    const open = board.rigs.flatMap((rig) => rig.bays).filter((bay) => !bay.collapsed);
    assert.deepEqual(
      open.map((bay) => bay.area.id),
      ['browser:core/queue'],
    );
  });
});

describe('traces', () => {
  it('stands a daughter in for its parent, so a link to it ends on the parent chip', () => {
    const board = boardAt('classes');
    assert.equal(board.anchorOf.get(ROW), chipId(PAGE));
    assert.equal(board.anchorOf.get(PAGE), chipId(PAGE));
  });

  it('draws no trace between a parent and its own daughter', () => {
    const traces = boardAt('classes').traces;
    assert.equal(
      traces.some((trace) => trace.from === chipId(PAGE) && trace.to === chipId(PAGE)),
      false,
    );
    assert.equal(traces.length, SAMPLE_MAP.edges.length - 1);
  });

  it('merges the edges of one kind between the same two boxes into one trace', () => {
    const extra = {
      ...SAMPLE_MAP.edges.find((edge) => edge.to === STORE && edge.from === PAGE),
      kind: 'injects' as const,
    };
    const map: ArchitectureMap = {
      ...SAMPLE_MAP,
      edges: [
        ...SAMPLE_MAP.edges,
        { ...extra, from: ROW, to: STORE, how: 'inject', members: [], marks: ['boundary'] },
      ],
    };
    const trace = boardAt('classes', map).traces.find(
      (each) => each.from === chipId(PAGE) && each.to === chipId(STORE),
    );
    assert.equal(trace?.edges.length, 2);
    assert.deepEqual(trace?.marks, ['boundary']);
  });

  it('joins closed bays by the edges between their classes, and counts the links inside each', () => {
    const board = boardAt('areas');
    const between = board.traces.find(
      (trace) => trace.from === bayId('browser:core/queue') && trace.to === bayId('server:github'),
    );
    assert.equal(between?.kind, 'imports');
    assert.deepEqual(between?.marks, ['boundary']);
    assert.equal(board.internalLinks.get(bayId('browser:core/queue')), 5);
  });

  it('folds every kind of code edge between two closed bays into one trace, and keeps flow apart', () => {
    const extra = (kind: 'uses' | 'calls' | 'spawns', from: string, to: string) => ({
      from,
      to,
      kind,
      how: null,
      members: [],
      marks: [],
    });
    const map: ArchitectureMap = {
      ...SAMPLE_MAP,
      edges: [
        ...SAMPLE_MAP.edges,
        extra('uses', FEED, GITHUB_CLIENT),
        extra('calls', FEED, GITHUB_CLIENT),
        extra('spawns', FEED, GITHUB_CLIENT),
      ],
    };
    const between = boardAt('areas', map).traces.filter(
      (trace) => trace.from === bayId('browser:core/queue') && trace.to === bayId('server:github'),
    );
    assert.deepEqual(
      between.map((trace) => [trace.flow, trace.edges.length]),
      [
        [false, 3],
        [true, 1],
      ],
    );
  });

  it('tells a flow trace from a code trace, and keeps cycle marks', () => {
    const board = boardAt('classes');
    const byKind = (kind: string) => board.traces.find((trace) => trace.kind === kind);
    assert.equal(byKind('requests')?.flow, true);
    assert.equal(byKind('injects')?.flow, false);
    const cycle = board.traces.find(
      (trace) => trace.from === chipId(STORE) && trace.to === chipId(FEED),
    );
    assert.deepEqual(cycle?.marks, ['cycle']);
  });

  it('starts every trace and ends it at a box that is on the board', () => {
    for (const level of ['areas', 'classes', 'members'] as const) {
      const board = boardAt(level);
      const boxes = new Set(
        board.rigs.flatMap((rig) =>
          rig.bays.flatMap((bay) => [bay.id, ...bay.chips.map(({ id }) => id)]),
        ),
      );
      for (const trace of board.traces) {
        assert.ok(
          boxes.has(trace.from) && boxes.has(trace.to),
          `${level}: ${trace.from} to ${trace.to}`,
        );
      }
    }
  });
});
