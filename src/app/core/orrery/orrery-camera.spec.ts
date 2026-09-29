import { CAMERA_DISTANCE, depthAt, OrreryCamera, clampScale } from './orrery-camera';

const view = { width: 1000, height: 800 };

describe('OrreryCamera', () => {
  it('maps the orrery to the screen and back', () => {
    const camera = new OrreryCamera({ x: 10, y: -20, scale: 2 });

    const [sx, sy] = camera.toScreen(60, 30, view);
    expect([sx, sy]).toEqual([600, 500]);
    expect(camera.toOrrery(sx, sy, view)).toEqual([60, 30]);
  });

  it('zooms about the pointer, keeping the point under it still', () => {
    const camera = new OrreryCamera({ x: 0, y: 0, scale: 1 });
    const before = camera.toOrrery(800, 200, view);

    camera.zoomAt(800, 200, 2, view);
    camera.settle();

    expect(camera.toOrrery(800, 200, view)[0]).toBeCloseTo(before[0]);
    expect(camera.toOrrery(800, 200, view)[1]).toBeCloseTo(before[1]);
    expect(camera.current.scale).toBe(2);
  });

  it('eases toward its target rather than jumping', () => {
    const camera = new OrreryCamera({ x: 0, y: 0, scale: 1 });
    camera.pan(100, 0);

    expect(camera.advance(1 / 60, false)).toBe(true);
    expect(camera.current.x).toBeGreaterThan(0);
    expect(camera.current.x).toBeLessThan(100);
  });

  it('comes to rest', () => {
    const camera = new OrreryCamera({ x: 0, y: 0, scale: 1 });
    camera.pan(100, 0);
    let moving = true;
    for (let frame = 0; frame < 600 && moving; frame++) moving = camera.advance(1 / 60, false);

    expect(moving).toBe(false);
    expect(camera.current.x).toBeCloseTo(100, 0);
  });

  it('keeps drifting after a flick, then stops', () => {
    const camera = new OrreryCamera({ x: 0, y: 0, scale: 1 });
    camera.drag(-10, 0);
    const released = camera.target.x;
    camera.advance(1 / 60, false);

    expect(camera.target.x).toBeGreaterThan(released);
  });

  it('fits the whole system on screen', () => {
    const camera = new OrreryCamera({ x: 300, y: 300, scale: 3 });

    camera.fit(460, view);

    // 600 units out each way: the height (600 px for 810 units) limits it, not the width.
    expect(camera.target.x).toBe(0);
    expect(camera.target.y).toBe(0);
    expect(camera.target.scale).toBeCloseTo(600 / 810);
  });

  it('frames a box, centred, with room round it', () => {
    const camera = new OrreryCamera();

    camera.fitBox({ left: 100, top: 100, right: 900, bottom: 400 }, view, 100);

    expect(camera.target.x).toBe(500);
    expect(camera.target.y).toBe(250);
    // 1000 units wide against 1000 px; 500 tall against 600 px: width limits it.
    expect(camera.target.scale).toBe(1);
  });

  it('never zooms beyond its limits', () => {
    expect(clampScale(100)).toBe(3);
    expect(clampScale(0)).toBe(0.04);
  });

  it('draws a point toward the viewer a little larger and further out, as the 3D camera does', () => {
    const camera = new OrreryCamera({ x: 0, y: 0, scale: 1 });
    const view = { width: 1000, height: 800 };

    expect(camera.toScreenAt(100, 50, 0, view)).toEqual(camera.toScreen(100, 50, view));
    const [x] = camera.toScreenAt(100, 0, 600, view);
    expect(x).toBeCloseTo(500 + 100 * depthAt(600));
    expect(depthAt(600)).toBeCloseTo(CAMERA_DISTANCE / (CAMERA_DISTANCE - 600));
    expect(depthAt(-600)).toBeLessThan(1);
  });
});
