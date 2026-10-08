import { coreRadius, depthChart, shellRadius } from './depth-chart';
import { depthModule } from './testing/depth-fixture';

describe('a planet', () => {
  it('has a core that grows with the work and a shell that grows with the interface', () => {
    const small = depthModule('a.ts', 4, 2);
    const worked = depthModule('b.ts', 400, 2);
    const wide = depthModule('c.ts', 4, 40);

    expect(coreRadius(worked.implementation)).toBeGreaterThan(coreRadius(small.implementation));
    expect(shellRadius(wide) - coreRadius(wide.implementation)).toBeGreaterThan(
      shellRadius(small) - coreRadius(small.implementation),
    );
  });

  it('follows area, not width: four times the work is twice the core', () => {
    expect(coreRadius(400) / coreRadius(100)).toBeCloseTo(2, 5);
  });

  it('shows a deep module as nearly all core and a shallow one as mostly empty ring', () => {
    const deep = depthModule('deep.ts', 400, 2);
    const shallow = depthModule('shallow.ts', 1, 40);
    const hollowness = (module: typeof deep) =>
      1 - coreRadius(module.implementation) / shellRadius(module);

    expect(hollowness(deep)).toBeLessThan(0.25);
    expect(hollowness(shallow)).toBeGreaterThan(0.75);
  });

  it('is never smaller than a speck, even with no work and no interface', () => {
    const nothing = depthModule('nothing.ts', 0, 0);

    expect(coreRadius(nothing.implementation)).toBeGreaterThan(0);
    expect(shellRadius(nothing)).toBeGreaterThan(coreRadius(0));
  });
});

describe('depthChart', () => {
  const MODULES = [
    depthModule('src/a/one.ts', 50, 3),
    depthModule('src/a/two.ts', 5, 9),
    depthModule('src/b/three.ts', 120, 4),
    depthModule('top.ts', 3, 2),
  ];

  it('makes a system of each folder, in path order, the root one first', () => {
    const chart = depthChart(MODULES);

    expect(chart.systems.map(({ folder, name }) => [folder, name])).toEqual([
      ['', 'root'],
      ['src/a', 'a'],
      ['src/b', 'b'],
    ]);
  });

  it('draws every module exactly once, largest first within its folder', () => {
    const chart = depthChart(MODULES);

    expect(chart.planets.map(({ module }) => module.file)).toEqual([
      'top.ts',
      'src/a/one.ts',
      'src/a/two.ts',
      'src/b/three.ts',
    ]);
    expect(chart.planets).toEqual(chart.systems.flatMap(({ planets }) => planets));
  });

  it('keeps each planet inside its folder disc and the discs clear of each other', () => {
    const { systems } = depthChart(MODULES);

    for (const system of systems) {
      for (const planet of system.planets) {
        const reach = Math.hypot(planet.x - system.x, planet.y - system.y) + planet.shell;
        expect(reach).toBeLessThanOrEqual(system.r);
      }
    }
    systems.forEach((a, i) =>
      systems.slice(i + 1).forEach((b) => {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
      }),
    );
  });

  it('frames the whole sky in its box', () => {
    const { systems, box } = depthChart(MODULES);

    for (const { x, y, r } of systems) {
      expect(x - r).toBeGreaterThanOrEqual(box.x);
      expect(x + r).toBeLessThanOrEqual(box.x + box.width);
      expect(y - r).toBeGreaterThanOrEqual(box.y);
      expect(y + r).toBeLessThanOrEqual(box.y + box.height);
    }
  });

  it('is an empty sky when there are no modules', () => {
    expect(depthChart([])).toEqual({
      systems: [],
      planets: [],
      box: { x: 0, y: 0, width: 0, height: 0 },
    });
  });

  it('lays a whole repository out in well under a second', () => {
    const many = Array.from({ length: 1100 }, (_, i) =>
      depthModule(`src/f${i % 140}/m${i}.ts`, 1 + ((i * 37) % 300), 1 + ((i * 11) % 30)),
    );
    const started = performance.now();

    depthChart(many);

    expect(performance.now() - started).toBeLessThan(1000);
  });
});
