import {
  GALAXY_CENTRE_X,
  GALAXY_CENTRE_Y,
  GalaxyView,
  armAngle,
  galaxyToScreen,
} from './galaxy-geometry';

const view: GalaxyView = { width: 1600, height: 900, x: 0, y: 0, scale: 1, t: 0 };

describe('galaxyToScreen', () => {
  it('puts the core where the shader centres the galaxy', () => {
    const aspect = 1600 / 900;
    const [x, y] = galaxyToScreen(0, 0, view);

    expect(x).toBeCloseTo(((GALAXY_CENTRE_X * aspect) / aspect + 0.5) * 1600);
    expect(y).toBeCloseTo((1 - (GALAXY_CENTRE_Y + 0.5)) * 900);
  });

  it('draws the disc tilted: a radius reaches further along the major axis than across', () => {
    const [cx, cy] = galaxyToScreen(0, 0, view);
    const reach = (theta: number) => {
      const [x, y] = galaxyToScreen(0.2, theta, view);
      return Math.hypot(x - cx, y - cy);
    };
    expect(reach(0)).toBeGreaterThan(reach(Math.PI / 2) * 2);
  });
});

describe('armAngle', () => {
  it('winds outward, with the second arm opposite the first, and turns with the spin', () => {
    expect(armAngle(0.2, 1, 0) - armAngle(0.2, 0, 0)).toBeCloseTo(Math.PI);
    expect(armAngle(0.2, 0, 0.5) - armAngle(0.2, 0, 0)).toBeCloseTo(0.5);
    expect(armAngle(0.3, 0, 0)).toBeGreaterThan(armAngle(0.1, 0, 0));
  });
});
