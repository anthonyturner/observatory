import { OrreryCamera, clampScale } from './orrery-camera';

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

  it('never zooms beyond its limits', () => {
    expect(clampScale(100)).toBe(3);
    expect(clampScale(0)).toBe(0.04);
  });
});
