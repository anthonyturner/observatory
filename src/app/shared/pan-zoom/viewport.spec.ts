import {
  MAX_SCALE,
  MIN_SCALE,
  READABLE_SCALE,
  centredOn,
  fitViewport,
  panBy,
  recentred,
  resized,
  startViewport,
  svgTransformOf,
  zoomAt,
} from './viewport';

const FRAME = { width: 1000, height: 600 };
const SMALL = { x: -100, y: -100, width: 200, height: 200 };
const LARGE = { x: -1000, y: -1000, width: 2000, height: 2000 };

describe('fitViewport', () => {
  it('shrinks a large drawing to fit and centres it', () => {
    const fit = fitViewport(LARGE, FRAME, 20);
    expect(fit.scale).toBeCloseTo(0.28);
    expect(fit).toMatchObject({ x: 500, y: 300 });
  });

  it('blows a small drawing up only so far', () => {
    expect(fitViewport(SMALL, FRAME, 20).scale).toBe(1.5);
  });
});

describe('startViewport', () => {
  it('shows a drawing whole when it fits at a readable size', () => {
    expect(startViewport(SMALL, FRAME, 20)).toEqual(fitViewport(SMALL, FRAME, 20));
  });

  it('opens a large drawing readable and centred instead of shrinking it', () => {
    expect(startViewport(LARGE, FRAME, 20)).toEqual({ scale: READABLE_SCALE, x: 500, y: 300 });
  });
});

describe('recentred', () => {
  it('keeps the scale and centres the new drawing', () => {
    const next = recentred(
      { scale: 2, x: 7, y: 9 },
      { x: 0, y: 0, width: 100, height: 100 },
      FRAME,
    );
    expect(next).toEqual({ scale: 2, x: 400, y: 200 });
  });
});

describe('zoomAt', () => {
  it('keeps the point under the focus still', () => {
    const before = centredOn({ x: 0, y: 0 }, 1, FRAME);
    const focus = { x: 700, y: 100 };
    const after = zoomAt(before, 2, focus);
    const under = (v: typeof before) => ({
      x: (focus.x - v.x) / v.scale,
      y: (focus.y - v.y) / v.scale,
    });
    expect(under(after)).toEqual(under(before));
    expect(after.scale).toBe(2);
  });

  it('stops at the scale limits', () => {
    const start = { x: 0, y: 0, scale: 1 };
    expect(zoomAt(start, 1000, { x: 0, y: 0 }).scale).toBe(MAX_SCALE);
    expect(zoomAt(start, 0.0001, { x: 0, y: 0 }).scale).toBe(MIN_SCALE);
  });
});

describe('panBy and resized', () => {
  it('moves the drawing by pixels', () => {
    expect(panBy({ x: 1, y: 2, scale: 3 }, 10, -5)).toEqual({ x: 11, y: -3, scale: 3 });
  });

  it('keeps the centre still when the frame grows', () => {
    const grown = resized({ x: 0, y: 0, scale: 1 }, FRAME, { width: 1200, height: 700 });
    expect(grown).toEqual({ x: 100, y: 50, scale: 1 });
  });
});

it('writes an SVG transform', () => {
  expect(svgTransformOf({ x: 4, y: -2, scale: 0.5 })).toBe('translate(4 -2) scale(0.5)');
});
