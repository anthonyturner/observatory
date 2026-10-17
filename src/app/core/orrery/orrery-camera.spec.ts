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

  describe('fit', () => {
    const sun = { x: -300, y: -150, z: -100, distance: 400, radius: 40 };

    it('frames the orbits when the sun is nearer than they are', () => {
      const camera = new OrreryCamera({ x: 300, y: 300, scale: 3 });

      camera.fit({ outermostOrbit: 460, sun }, view);

      // 600 units out each way: the height (600 px for 810 units) limits it, not the width.
      expect(camera.target.x).toBe(0);
      expect(camera.target.y).toBe(0);
      expect(camera.target.scale).toBeCloseTo(600 / 810);
    });

    it('grows to take in the sun, staying centred on the Earth', () => {
      const camera = new OrreryCamera();
      const far = { ...sun, distance: 900, radius: 60 };

      camera.fit({ outermostOrbit: 460, sun: far }, view);

      // 930 units out: 600 px of height for 930 * 1.35 units.
      expect(camera.target.x).toBe(0);
      expect(camera.target.y).toBe(0);
      expect(camera.target.scale).toBeCloseTo(600 / (930 * 1.35));
    });

    describe('on a phone', () => {
      const phone = { width: 390, height: 844 };
      const edge = { x: -640, y: -370, z: -500, distance: 1200, radius: 56 };

      it('zooms out no more than 15% beyond the orbits alone', () => {
        const camera = new OrreryCamera();
        camera.fit({ outermostOrbit: 700, sun: edge }, phone);
        const withoutSun = new OrreryCamera();
        withoutSun.fit({ outermostOrbit: 700, sun: { ...edge, distance: 0 } }, phone);

        expect(camera.target.scale).toBeCloseTo(withoutSun.target.scale / 1.15);
      });

      it('keeps the sun’s centre on screen, with half its radius to spare', () => {
        const camera = new OrreryCamera();
        camera.fit({ outermostOrbit: 700, sun: edge }, phone);
        const [sx, sy] = camera.toScreen(0, 0, phone);
        const { scale } = camera.target;

        expect(Math.abs(edge.x) * scale + 0.5 * edge.radius * scale).toBeLessThanOrEqual(
          phone.width / 2,
        );
        expect(Math.abs(edge.y) * scale + 0.5 * edge.radius * scale).toBeLessThanOrEqual(
          (phone.height - 200) / 2,
        );
        expect([sx, sy]).toEqual([phone.width / 2, phone.height / 2]);
      });

      it('lets the sun’s centre win over the zoom-out cap when they disagree', () => {
        const camera = new OrreryCamera();
        const wide = { ...edge, x: -2400, y: -300, distance: 2500 };

        camera.fit({ outermostOrbit: 700, sun: wide }, phone);

        expect(camera.target.scale).toBeLessThan(0.1);
        expect(2400 * camera.target.scale).toBeLessThan(phone.width / 2);
      });
    });
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
