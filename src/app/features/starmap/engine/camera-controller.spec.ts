import { CameraController, clampScale } from './camera-controller';

const view = () => ({ width: 1000, height: 600 });
const camera = () => new CameraController({ x: 500, y: 300, scale: 1 }, 4200, view);

describe('CameraController', () => {
  it('projects the world through depth, and back', () => {
    const cam = camera();

    expect(cam.project(500, 300)).toEqual([500, 300]);
    expect(cam.project(600, 300)).toEqual([600, 300]);
    const [sx, sy] = cam.project(600, 400, 200);
    expect(cam.unproject(sx, sy, 200)).toEqual([600, 400]);
    expect(cam.depth(200)).toBeCloseTo(4200 / 4000);
  });

  it('chases its target rather than jumping to it', () => {
    const cam = camera();
    cam.target.x = 600;

    cam.chase(1 / 60, false);

    expect(cam.current.x).toBeGreaterThan(500);
    expect(cam.current.x).toBeLessThan(600);
    expect(cam.settled()).toBe(false);
  });

  it('keeps coasting on its velocity until a drag holds it', () => {
    const cam = camera();
    cam.velocity.x = 10;

    cam.chase(1 / 60, true);
    expect(cam.target.x).toBe(500);
    cam.chase(1 / 60, false);
    expect(cam.target.x).toBe(510);
  });

  it('clamps zoom to the chart’s range', () => {
    expect(clampScale(10)).toBe(3.2);
    expect(clampScale(0.001)).toBe(0.04);
  });
});
