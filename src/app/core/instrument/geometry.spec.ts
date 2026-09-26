import { ProjectSnapshot } from '../projects/project.types';
import { ballCount2D, ballNetwork } from './ball-network';
import { MAX_BEADS, layoutBeads, stalePulse, stalenessOf } from './beads';
import { coreRadius, coreViewOf } from './core-view';
import { FLOOR_STRIDE, buildFloorGrid, floorBatches, floorKey } from './floor-grid';
import { ORBIT, TIER_RING } from './proportions';
import { orbitLoop, tierArcs } from './rings';
import { tilt } from './tilt';

const ZERO_COUNTS = {
  conflicted: 0,
  failing: 0,
  unknown: 0,
  unlinked: 0,
  unreviewed: 0,
  unclaimed: 0,
};

function project(name: string, overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    name,
    repo: `owner/${name}`,
    dashboardUrl: `/p/owner/${name}`,
    open: 1,
    counts: ZERO_COUNTS,
    ...overrides,
  };
}

describe('tilt', () => {
  it('leaves the centre and the x axis alone', () => {
    expect(tilt(5, 0, 0)).toEqual({ x: 5, y: 0, z: 0 });
  });

  it('keeps a point its distance from the centre', () => {
    const seen = tilt(0, 3, 4);
    expect(Math.hypot(seen.x, seen.y, seen.z)).toBeCloseTo(5);
  });
});

describe('coreViewOf', () => {
  const viewport = { width: 1280, height: 720, scrollY: 0, pixelRatio: 3 };

  it('centres the core in its anchor, capped in size and pixel ratio', () => {
    const view = coreViewOf({ left: 300, top: 100, width: 600, height: 600 }, viewport);
    expect(view.centreX).toBe(600);
    expect(view.centreY).toBe(400);
    expect([view.poleX, view.poleY]).toEqual([600, 400]);
    expect(view.radius).toBe(175);
    expect(view.pixelRatio).toBe(2);
    expect(view.isAway).toBe(false);
    expect(view.lift).toBe(1);
  });

  it('is away once the anchor has scrolled off the top', () => {
    const view = coreViewOf({ left: 0, top: -500, width: 400, height: 400 }, viewport);
    expect(view.isAway).toBe(true);
    expect(view.lift).toBe(0);
  });

  it('never shrinks the core below a readable size', () => {
    expect(coreRadius({ left: 0, top: 0, width: 20, height: 20 })).toBe(36);
  });

  it('rounds the floor depth so small scrolls do not rebuild it', () => {
    const at = (scrollY: number): number =>
      coreViewOf({ left: 0, top: 100 - scrollY, width: 400, height: 400 }, { ...viewport, scrollY })
        .floorDepth;
    expect(at(0)).toBe(at(30));
    expect(at(0) % 80).toBe(0);
  });
});

describe('ballNetwork', () => {
  it('is the same ball on every call, and cached', () => {
    expect(ballNetwork(300)).toBe(ballNetwork(300));
    expect(ballNetwork(300).points[0]).toBe(ballNetwork(400).points[0]);
  });

  it('keeps every point inside the unit sphere', () => {
    const { points, count } = ballNetwork(480);
    for (let i = 0; i < count; i++) {
      expect(Math.hypot(points[i * 3], points[i * 3 + 1], points[i * 3 + 2])).toBeLessThanOrEqual(
        1,
      );
    }
  });

  it('links each point to at most two neighbours, never itself, strongest when nearest', () => {
    const { links, count } = ballNetwork(480);
    expect(links.length / 3).toBeLessThanOrEqual(count * 2);
    for (let i = 0; i < links.length; i += 3) {
      expect(links[i]).not.toBe(links[i + 1]);
      expect(links[i + 2]).toBeGreaterThan(0);
      expect(links[i + 2]).toBeLessThanOrEqual(1);
    }
  });

  it('follows the core area in 2D, within its floor and ceiling', () => {
    expect(ballCount2D(36)).toBe(250);
    expect(ballCount2D(175)).toBe(480);
  });
});

describe('rings', () => {
  it('lays the orbit at ORBIT core radii', () => {
    const loop = orbitLoop(100);
    expect(Math.hypot(loop[0], loop[1], loop[2])).toBeCloseTo(100 * ORBIT, 3);
  });

  it('draws three tier arcs on the tier ring', () => {
    const arcs = tierArcs(100, 0);
    expect(arcs).toHaveLength(3);
    const [x, y, z] = arcs[1];
    expect(Math.hypot(x, y, z)).toBeCloseTo(100 * TIER_RING, 3);
  });
});

describe('layoutBeads', () => {
  const blocked = project('blocked', { counts: { ...ZERO_COUNTS, failing: 1 } });
  const clear = project('clear');

  it('puts the worst project first, at twelve o’clock, ringed', () => {
    const { beads } = layoutBeads([clear, blocked], 100);
    expect(beads.map((b) => b.key)).toEqual(['owner/blocked', 'owner/clear']);
    expect(beads[0].x).toBeCloseTo(0);
    expect(beads[0].z).toBeLessThan(0);
    expect(beads[0].isRinged).toBe(true);
    expect(beads[1].isRinged).toBe(false);
  });

  it('grows a bead with open work, within bounds', () => {
    const { beads } = layoutBeads([project('a', { open: 0 }), project('b', { open: 100 })], 140);
    const [small, large] = [...beads].sort((a, b) => a.size - b.size);
    expect(small.size).toBe(3);
    expect(large.size).toBe(10);
  });

  it('shows the rest as one overflow mark past MAX_BEADS', () => {
    const many = Array.from({ length: MAX_BEADS + 3 }, (_, i) => project(`p${i}`));
    const { beads, overflow } = layoutBeads(many, 100);
    expect(beads).toHaveLength(MAX_BEADS);
    expect(overflow?.count).toBe(3);
  });

  it('staggers the beads so they grow in one after another', () => {
    const { beads } = layoutBeads([clear, blocked], 100);
    expect(beads[1].delay).toBeGreaterThan(beads[0].delay);
  });
});

describe('buildFloorGrid', () => {
  const size = { coreRadius: 150, windowWidth: 1280, depth: 480 };

  it('keys the grid by what shapes it', () => {
    expect(buildFloorGrid(size).key).toBe(floorKey(size));
  });

  it('fades each end on its own, all under the horizon', () => {
    const { segments } = buildFloorGrid(size);
    expect(segments.length % FLOOR_STRIDE).toBe(0);
    for (let i = 0; i < segments.length; i += FLOOR_STRIDE) {
      expect(segments[i + 1]).toBeGreaterThan(150);
      expect(segments[i + 3]).toBeGreaterThan(150);
      expect(segments[i + 4]).toBeLessThanOrEqual(0.45);
    }
  });

  it('batches segments by brightness for a canvas, faint to bright', () => {
    const batches = floorBatches(buildFloorGrid(size));
    expect(batches.length).toBeGreaterThan(1);
    for (let i = 1; i < batches.length; i++) {
      expect(batches[i].alpha).toBeGreaterThan(batches[i - 1].alpha);
    }
    for (const { segments } of batches) expect(segments.length % 4).toBe(0);
  });
});

describe('staleness', () => {
  it('stays fresh for a week, then fades to its faintest by six weeks', () => {
    expect(stalenessOf(project('a', { oldestIdleDays: 3 }))).toBe(0);
    expect(stalenessOf(project('a', { oldestIdleDays: 7 }))).toBe(0);
    expect(stalenessOf(project('a', { oldestIdleDays: 20 }))).toBeGreaterThan(0);
    expect(stalenessOf(project('a', { oldestIdleDays: 90 }))).toBe(1);
    expect(stalenessOf(project('a'))).toBe(0);
  });

  it('dims a stale bead and gives it a ring that pulses, or holds when still', () => {
    const { beads } = layoutBeads(
      [project('fresh', { oldestIdleDays: 1 }), project('old', { oldestIdleDays: 60 })],
      100,
    );
    const [fresh, old] = [...beads].sort((a, b) => a.staleness - b.staleness);
    expect(old.staleness).toBe(1);
    expect(stalePulse(fresh.staleness, 1, false)).toBe(0);
    expect(stalePulse(old.staleness, 0, false)).not.toBe(stalePulse(old.staleness, 1, false));
    expect(stalePulse(old.staleness, 0, true)).toBe(stalePulse(old.staleness, 5, true));
  });
});
