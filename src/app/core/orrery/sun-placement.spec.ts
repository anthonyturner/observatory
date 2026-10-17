import { ProjectCounts, ProjectSnapshot } from '../projects/project.types';
import { OrreryCamera } from './orrery-camera';
import {
  DIAL_BEYOND_ORBIT,
  dialRadius,
  sunPlacement,
  sunwardAngle,
  systemExtent,
} from './sun-placement';
import { OrreryWorld, layoutWorlds, sunRadius } from './world-layout';
import { ORBIT_SQUASH } from './orbit';

const quiet: ProjectCounts = {
  conflicted: 0,
  failing: 0,
  unknown: 0,
  unlinked: 0,
  unreviewed: 0,
  unclaimed: 0,
};
const project = (name: string, open: number, oldestIdleDays: number): ProjectSnapshot => ({
  name,
  repo: `me/${name}`,
  dashboardUrl: `/p/me/${name}`,
  open,
  counts: quiet,
  oldestIdleDays,
});

const worlds = (): OrreryWorld[] =>
  layoutWorlds([project('a', 12, 5), project('b', 3, 30), project('c', 20, 60)]);

describe('sunPlacement', () => {
  it('stands beyond the dial, just outside the house names', () => {
    const sun = sunPlacement(worlds());

    expect(dialRadius(worlds())).toBe(
      Math.max(...worlds().map((world) => world.orbit)) + DIAL_BEYOND_ORBIT,
    );
    expect(sun.distance - sun.radius).toBeGreaterThan(dialRadius(worlds()) * 1.07);
    expect(Math.hypot(sun.x, sun.y / ORBIT_SQUASH)).toBeCloseTo(sun.distance);
  });

  it('reads about ten o’clock on screen, whatever the layout', () => {
    for (const set of [worlds(), layoutWorlds([project('only', 1, 0)])]) {
      const sun = sunPlacement(set);
      const bearing = (Math.atan2(-sun.y, sun.x) * 180) / Math.PI;

      expect(bearing).toBeCloseTo(150);
    }
  });

  it('keeps the sun’s size, which grows with open pull requests', () => {
    expect(sunPlacement(worlds()).radius).toBe(sunRadius(worlds()));
    expect(sunPlacement(layoutWorlds([project('big', 80, 0)])).radius).toBeGreaterThan(
      sunPlacement(layoutWorlds([project('small', 1, 0)])).radius,
    );
  });

  it('is contained by the default Fit, disc and all, on a desktop screen', () => {
    const view = { width: 1440, height: 900 };
    const camera = new OrreryCamera();
    const { sun } = systemExtent(worlds());

    camera.fit(systemExtent(worlds()), view);
    camera.settle();
    const [x, y] = camera.toScreen(sun.x, sun.y, view);
    const reach = sun.radius * camera.current.scale;

    expect(x - reach).toBeGreaterThan(0);
    expect(y - reach).toBeGreaterThan(0);
    expect(x + reach).toBeLessThan(view.width);
    expect(y + reach).toBeLessThan(view.height);
  });
});

describe('sunwardAngle', () => {
  it('points at the sun, not at the centre', () => {
    const sun = { x: -300, y: -200 };

    expect(sunwardAngle({ x: 0, y: 0 }, sun)).toBeCloseTo(Math.atan2(-200, -300));
    expect(sunwardAngle({ x: -300, y: 100 }, sun)).toBeCloseTo(-Math.PI / 2);
    expect(sunwardAngle({ x: -500, y: -200 }, sun)).toBeCloseTo(0);
  });
});
