import { ProjectCounts, ProjectSnapshot } from '../projects/project.types';
import { CLOUD_SCALE } from '../../shared/planets/planet-shaders';
import { depthPlanes, depthStep } from './depth-planes';
import { orbitPoint, worldPosition } from './orbit';
import { EARTH_RADIUS } from './earth';
import { CAMERA_DISTANCE, clampScale } from './orrery-camera';
import { FIELD_SPREAD_3D, FIELD_STARS_3D, starField } from './star-field';
import { SUN_CORONA_REACH, dialRadius, sunPlacement } from './sun-placement';
import {
  AIR_SCALE,
  MAX_MOONS,
  MOON_TILT,
  OrreryWorld,
  RING_OUTER,
  layoutWorlds,
  moonOrbitRadius,
  moonRadius,
} from './world-layout';

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

const crowd = (count: number): OrreryWorld[] =>
  layoutWorlds(
    Array.from({ length: count }, (_, i) => project(`p${i}`, (i * 7) % 60, (i * 11) % 90)),
  );

const scenes: Record<string, OrreryWorld[]> = {
  empty: [],
  one: layoutWorlds([project('a', 3, 4)]),
  forty: crowd(40),
};

const OLD_PLANES = { near: 1, far: 100000 };
const EARTH_CLOUD_GAP = EARTH_RADIUS * (CLOUD_SCALE - 1);
const MIN_SCALE = clampScale(0);
const AROUND = Array.from({ length: 360 }, (_, step) => (step / 360) * Math.PI * 2);

/** How far a point `z` toward the viewer is from the camera, along its line of sight. */
const distanceOf = (z: number): number => CAMERA_DISTANCE - z;

describe('depthPlanes', () => {
  for (const [name, worlds] of Object.entries(scenes)) {
    describe(`with ${name} worlds`, () => {
      const planes = depthPlanes(worlds);
      const inside = (z: number): boolean =>
        distanceOf(z) > planes.near && distanceOf(z) < planes.far;

      it('keeps every world, with its air, ring and moons, between the planes all round its orbit', () => {
        for (const world of worlds) {
          const { radius } = world;
          const moonSize = moonRadius(radius, MIN_SCALE);
          for (const angle of AROUND) {
            const at = orbitPoint(world.orbit, angle, world.tilt);
            const moon = orbitPoint(moonOrbitRadius(radius, MAX_MOONS - 1), angle, MOON_TILT);
            for (const sign of [1, -1]) {
              expect(inside(at.z + sign * radius * AIR_SCALE)).toBe(true);
              expect(inside(at.z + sign * radius * RING_OUTER)).toBe(true);
              expect(inside(at.z + moon.z + sign * moonSize)).toBe(true);
            }
          }
          expect(inside(worldPosition(world, 0).z)).toBe(true);
        }
      });

      it('keeps the dial, the sun with its corona and the Earth between the planes', () => {
        const sun = sunPlacement(worlds);
        const dial = dialRadius(worlds);
        const dialZ = orbitPoint(dial, Math.PI / 2).z;

        expect(inside(dialZ)).toBe(true);
        expect(inside(-dialZ)).toBe(true);
        expect(inside(sun.z + sun.radius * SUN_CORONA_REACH)).toBe(true);
        expect(inside(sun.z - sun.radius * SUN_CORONA_REACH)).toBe(true);
        expect(inside(EARTH_RADIUS)).toBe(true);
        expect(inside(-EARTH_RADIUS)).toBe(true);
      });

      it('keeps every field star of the 3D sky between the planes', () => {
        for (const star of starField(FIELD_STARS_3D, FIELD_SPREAD_3D))
          expect(inside(star.z)).toBe(true);
      });

      it('resolves a gap far thinner than any world or Earth shell is from its ground', () => {
        const step = depthStep(CAMERA_DISTANCE, planes);
        const thinnest = Math.min(...worlds.map((world) => world.radius)) * (CLOUD_SCALE - 1);

        expect(step).toBeLessThan(thinnest / 20);
        expect(step).toBeLessThan(EARTH_CLOUD_GAP / 20);
      });
    });
  }

  it('never puts the near plane behind the lens, however wide the system grows', () => {
    expect(depthPlanes(crowd(2000)).near).toBeGreaterThan(0);
  });
});

describe('depthStep', () => {
  it('shows why the old planes flickered: a step of about 34 units where the scene is', () => {
    expect(depthStep(CAMERA_DISTANCE, OLD_PLANES)).toBeCloseTo(34, 0);
  });

  it('grows with the square of the distance and shrinks as the near plane closes in', () => {
    const planes = { near: 12000, far: 70000 };

    expect(depthStep(2000, planes)).toBeCloseTo(depthStep(1000, planes) * 4, 9);
    expect(depthStep(24000, { near: 24000, far: 70000 })).toBeLessThan(
      depthStep(24000, { near: 12000, far: 70000 }),
    );
  });
});
