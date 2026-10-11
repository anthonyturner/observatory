import { DIM_TOTAL_S, FLIGHT_S, Vec3, dimAt, dimSpot, flightAt, openDrops } from './merge-arrival';

describe('openDrops', () => {
  const read = (...entries: [string, number][]) => new Map(entries);
  const now = (...entries: [string, number][]) => entries.map(([repo, open]) => ({ repo, open }));

  it('names the projects whose open count fell, and no others', () => {
    const drops = openDrops(
      read(['o/a', 5], ['o/b', 2], ['o/c', 0]),
      now(['o/a', 4], ['o/b', 2], ['o/c', 1]),
    );
    expect(drops).toEqual(['o/a']);
  });

  it('does not count a project it had not seen, nor a rise', () => {
    expect(openDrops(read(), now(['o/new', 0]))).toEqual([]);
    expect(openDrops(read(['o/a', 1]), now(['o/a', 3]))).toEqual([]);
  });
});

describe('flightAt', () => {
  it('starts at the world, ends in the band and only moves forward', () => {
    expect(flightAt(-1)).toBe(0);
    expect(flightAt(0)).toBe(0);
    expect(flightAt(FLIGHT_S)).toBe(1);
    expect(flightAt(FLIGHT_S * 3)).toBe(1);
    expect(flightAt(FLIGHT_S * 0.7)).toBeGreaterThan(flightAt(FLIGHT_S * 0.3));
  });
});

describe('dimAt', () => {
  it('goes down quickly, stays out, then comes back to the data’s own lights', () => {
    expect(dimAt(0)).toBe(0);
    expect(dimAt(0.25)).toBeCloseTo(0.5);
    expect(dimAt(2)).toBe(1);
    expect(dimAt(DIM_TOTAL_S - 1)).toBeGreaterThan(0);
    expect(dimAt(DIM_TOTAL_S - 1)).toBeLessThan(1);
    expect(dimAt(DIM_TOTAL_S)).toBe(0);
  });
});

describe('dimSpot', () => {
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  it('is straight away from the sun when that faces the viewer', () => {
    const spot = dimSpot([0, 0, -1], [0, 0, 1]);
    expect(spot[2]).toBeCloseTo(1);
  });

  it('leans toward the viewer but stays on the night side', () => {
    const towardSun: Vec3 = [0, 0, 1];
    const towardViewer: Vec3 = [0, 1, 0.1];
    const spot = dimSpot(towardSun, towardViewer);

    expect(dot(spot, towardSun)).toBeLessThan(-0.2);
    expect(spot[1]).toBeGreaterThan(0.5);
    expect(Math.hypot(...spot)).toBeCloseTo(1);
  });

  it('holds still when the viewer is straight behind the sun', () => {
    const spot = dimSpot([1, 0, 0], [1, 0, 0]);
    expect(spot[0]).toBeCloseTo(-1);
  });
});
