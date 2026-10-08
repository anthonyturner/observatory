import { Milestone } from '../../../core/milestones/milestones-report';
import { Stage } from '../../releases/release-sky/release-path';
import { MAX_LANES, layoutTransit, planetRadius, pointAlong } from './transit-lanes';

const NOW = Date.parse('2026-10-08T13:00:00Z');
const STAGE: Stage = { left: 0, top: 0, width: 1000, height: 600 };

const milestone = (number: number, more: Partial<Milestone> = {}): Milestone => ({
  number,
  title: `v${number}`,
  description: null,
  url: `https://github.com/me/app/milestone/${number}`,
  isOpen: true,
  dueOn: null,
  closedAt: null,
  open: 2,
  closed: 2,
  items: [],
  ...more,
});

describe('pointAlong', () => {
  it('runs from launch to arrival, rising by its bow at the middle', () => {
    const lane = { from: { x: 0, y: 100 }, to: { x: 200, y: 100 }, bow: 20 };

    expect(pointAlong(lane, 0)).toEqual({ x: 0, y: 100 });
    expect(pointAlong(lane, 1)).toEqual({ x: 200, y: 100 });
    expect(pointAlong(lane, 0.5)).toEqual({ x: 100, y: 80 });
  });
});

describe('planetRadius', () => {
  it('grows with the square root of the items on it, up to a cap', () => {
    expect(planetRadius(0)).toBe(6);
    expect(planetRadius(4)).toBeCloseTo(10.4);
    expect(planetRadius(400)).toBe(20);
  });
});

describe('layoutTransit', () => {
  it('gives each milestone a lane in order, its planet as far along as it is done', () => {
    const layout = layoutTransit(
      [milestone(1, { open: 0, closed: 4 }), milestone(2, { open: 4, closed: 0 }), milestone(3)],
      STAGE,
      NOW,
    );

    const [done, untouched, half] = layout.lanes;
    expect(layout.lanes.map((lane) => lane.key)).toEqual(['1', '2', '3']);
    expect(done.y).toBeLessThan(untouched.y);
    expect([done.x, done.y]).toEqual([done.to.x, done.to.y]);
    expect([untouched.x, untouched.y]).toEqual([untouched.from.x, untouched.from.y]);
    expect(half.x).toBeCloseTo((half.from.x + half.to.x) / 2);
    expect(half.y).toBeLessThan(half.from.y);
    expect(done.state).toBe('done');
  });

  it('keeps the lanes no wider than its cap, centred on a wide stage', () => {
    const [lane] = layoutTransit([milestone(1)], { ...STAGE, width: 3000 }, NOW).lanes;

    expect(lane.to.x - lane.from.x).toBeLessThan(1100);
    expect((lane.from.x + lane.to.x) / 2).toBeCloseTo(1500);
  });

  it('draws at most its lanes, the soonest due, leaving the rest to the list', () => {
    const many = Array.from({ length: MAX_LANES + 3 }, (_, index) => milestone(index + 1));

    const layout = layoutTransit(many, STAGE, NOW);

    expect(layout.lanes.map((lane) => lane.key)).toEqual(
      many.slice(0, MAX_LANES).map((each) => String(each.number)),
    );
  });

  it('draws nothing on a stage with no room', () => {
    expect(layoutTransit([milestone(1)], { ...STAGE, width: 0 }, NOW).lanes).toEqual([]);
  });
});
