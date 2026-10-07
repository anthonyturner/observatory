import { ACTIONS_NOW, actionsRun } from '../../../core/actions/testing/actions-fixture';
import { CROWD_DEPTH, IDLE_DEPTH, frontDepth, layoutLanes, runRadius } from './run-lanes';
import { runMarks } from './run-marks';

const STAGE = { left: 0, top: 200, width: 1200, height: 600 };

describe('layoutLanes', () => {
  it('gives each workflow a lane, A to Z, ending at the present', () => {
    const layout = layoutLanes(
      [
        actionsRun(3, 10, { workflow: 'Deploy' }),
        actionsRun(2, 60),
        actionsRun(1, 600, { outcome: 'failed' }),
      ],
      ACTIONS_NOW,
      STAGE,
    );

    expect(layout.lanes.map((lane) => [lane.name, lane.count, lane.failing, lane.newest])).toEqual([
      ['CI', 2, 1, 'passed'],
      ['Deploy', 1, 0, 'passed'],
    ]);
    expect(layout.lanes.every((lane) => lane.near.x === layout.nowX)).toBe(true);
    expect(layout.lanes[0].near.y).toBeLessThan(layout.lanes[1].near.y);
  });

  it('puts older runs farther back, smaller, and lists them oldest first', () => {
    const layout = layoutLanes([actionsRun(2, 5), actionsRun(1, 600)], ACTIONS_NOW, STAGE);
    const [older, newer] = layout.runs;

    expect([older.key, newer.key]).toEqual(['1', '2']);
    expect(older.depth).toBeLessThan(newer.depth);
    expect(older.x).toBeLessThan(newer.x);
    expect(older.radius).toBeLessThan(newer.radius);
    expect(newer.order).toBe(1);
  });

  it('keeps runs started together apart along their lane', () => {
    const layout = layoutLanes(
      [actionsRun(3, 1), actionsRun(2, 1), actionsRun(1, 1)],
      ACTIONS_NOW,
      STAGE,
    );
    const xs = layout.runs.map((run) => run.x).sort((a, b) => a - b);

    expect(xs[1] - xs[0]).toBeGreaterThan(10);
    expect(xs[2] - xs[1]).toBeGreaterThan(10);
  });
});

describe('depth along a lane', () => {
  it('squeezes its runs evenly into the far end rather than piling the oldest on one spot', () => {
    const runs = Array.from({ length: 100 }, (_, index) => actionsRun(index + 1, 60 * 24 * 30));
    const depths = layoutLanes(runs, ACTIONS_NOW, STAGE)
      .runs.map((run) => run.depth)
      .sort((a, b) => a - b);

    expect(depths[0]).toBeGreaterThanOrEqual(CROWD_DEPTH - 1e-9);
    expect(new Set(depths.map((depth) => depth.toFixed(4))).size).toBe(100);
  });

  it('sets an idle lane back from the present, the last hours mattering most', () => {
    const hour = 3_600_000;
    const hourAgo = frontDepth(ACTIONS_NOW - hour, ACTIONS_NOW);
    const weekAgo = frontDepth(ACTIONS_NOW - 7 * 24 * hour, ACTIONS_NOW);

    expect(frontDepth(ACTIONS_NOW, ACTIONS_NOW)).toBe(1);
    expect(frontDepth(ACTIONS_NOW - 90 * 24 * hour, ACTIONS_NOW)).toBe(IDLE_DEPTH);
    expect(hourAgo).toBeGreaterThan(weekAgo);
    expect(hourAgo).toBeLessThan(1);
  });

  it('starts an idle lane farther back than a busy one', () => {
    const layout = layoutLanes(
      [actionsRun(2, 1), actionsRun(1, 60 * 24 * 20, { workflow: 'Deploy' })],
      ACTIONS_NOW,
      STAGE,
    );
    const depthOf = (key: string) => layout.runs.find((run) => run.key === key)?.depth ?? 0;

    expect(depthOf('2')).toBeGreaterThan(depthOf('1'));
  });
});

describe('runRadius', () => {
  it('grows with how long a run took, to a cap, and is mid-sized while it runs', () => {
    expect(runRadius(actionsRun(1, 0, { durationS: 60 }))).toBeLessThan(
      runRadius(actionsRun(2, 0, { durationS: 600 })),
    );
    expect(runRadius(actionsRun(3, 0, { durationS: 36_000 }))).toBe(18);
    expect(runRadius(actionsRun(4, 0, { durationS: null, outcome: 'running' }))).toBe(8);
  });
});

describe('runMarks', () => {
  it('names each run for the pointer and a screen reader, and each lane at the present', () => {
    const layout = layoutLanes(
      [actionsRun(41, 180, { outcome: 'failed', isFlaky: true, durationS: 192 })],
      ACTIONS_NOW,
      STAGE,
    );
    const marks = runMarks(layout, ACTIONS_NOW);

    expect(marks.runs[0].tip).toBe('CI #41 · Failed · flaky · main · 3m 12s · 3h ago');
    expect(marks.runs[0].spoken).toBe(
      'CI run 41, failed, flaky: Change 41. main, push by me, 3m 12s, 3h ago',
    );
    expect(marks.lanes[0]).toEqual(
      expect.objectContaining({ name: 'CI', count: '1 run · 1 failed' }),
    );
    expect(marks.now?.x).toBe(layout.nowX);
    expect(marks.isCompact).toBe(false);
  });

  it('shows names only when the lanes are packed close', () => {
    const runs = ['A', 'B', 'C', 'D', 'E', 'F'].map((workflow, index) =>
      actionsRun(index + 1, 5, { workflow }),
    );
    const short = { ...STAGE, height: 150 };

    expect(runMarks(layoutLanes(runs, ACTIONS_NOW, short), ACTIONS_NOW).isCompact).toBe(true);
  });

  it('has no present to label with no lanes', () => {
    expect(runMarks(layoutLanes([], ACTIONS_NOW, STAGE), ACTIONS_NOW).now).toBeNull();
  });
});
