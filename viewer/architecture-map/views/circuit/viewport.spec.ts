import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fitViewport,
  READABLE_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  panBy,
  revealBox,
  transformOf,
  viewportOn,
  zoomAt,
  type Viewport,
} from './viewport.ts';

const FRAME = { width: 1000, height: 600 };

describe('fitViewport', () => {
  it('shrinks a large board to fit and centres it', () => {
    const fit = fitViewport({ width: 4000, height: 1000 }, FRAME, 20);
    assert.equal(fit.scale, 0.24);
    assert.equal(fit.x, 20);
    assert.equal(fit.y, (600 - 1000 * 0.24) / 2);
  });

  it('does not blow a small board up', () => {
    const fit = fitViewport({ width: 200, height: 100 }, FRAME, 20);
    assert.equal(fit.scale, 1);
    assert.equal(fit.x, 400);
  });

  it('copes with an empty board and a frame too small for the margin', () => {
    assert.equal(fitViewport({ width: 0, height: 0 }, FRAME, 20).scale, 1);
    assert.ok(
      fitViewport({ width: 800, height: 800 }, { width: 10, height: 10 }, 20).scale >= MIN_SCALE,
    );
  });
});

describe('zoomAt', () => {
  it('keeps the board point under the pointer where it is', () => {
    const start: Viewport = { x: 50, y: 30, scale: 0.5 };
    const focus = { x: 400, y: 300 };
    const boardPoint = {
      x: (focus.x - start.x) / start.scale,
      y: (focus.y - start.y) / start.scale,
    };
    const zoomed = zoomAt(start, 2, focus);
    assert.equal(zoomed.scale, 1);
    assert.equal(boardPoint.x * zoomed.scale + zoomed.x, focus.x);
    assert.equal(boardPoint.y * zoomed.scale + zoomed.y, focus.y);
  });

  it('stops at the smallest and the largest scale', () => {
    const start: Viewport = { x: 0, y: 0, scale: 1 };
    assert.equal(zoomAt(start, 1000, { x: 0, y: 0 }).scale, MAX_SCALE);
    assert.equal(zoomAt(start, 0.0001, { x: 0, y: 0 }).scale, MIN_SCALE);
  });
});

describe('revealBox', () => {
  const start: Viewport = { x: 0, y: 0, scale: 1 };

  it('zooms in on a box when the board is too small to read', () => {
    const small: Viewport = { x: 0, y: 0, scale: READABLE_SCALE / 2 };
    const moved = revealBox(small, { x: 900, y: 500, width: 200, height: 100 }, FRAME, 20);
    assert.equal(moved.scale, 1);
    assert.equal(900 * moved.scale + moved.x, (1000 - 200) / 2);
  });

  it('leaves the view alone when the box is already in it', () => {
    assert.deepEqual(
      revealBox(start, { x: 100, y: 100, width: 200, height: 100 }, FRAME, 20),
      start,
    );
  });

  it('moves by the least needed to bring a box in from the right and the bottom', () => {
    const moved = revealBox(start, { x: 900, y: 550, width: 200, height: 100 }, FRAME, 20);
    assert.equal(moved.x, 1000 - 20 - 1100);
    assert.equal(moved.y, 600 - 20 - 650);
  });

  it('brings a box in from the top left', () => {
    const away = panBy(start, -500, -500);
    const moved = revealBox(away, { x: 100, y: 100, width: 50, height: 50 }, FRAME, 20);
    assert.equal(moved.x, 20 - 100);
  });

  it('shows the top left of a box too big for the frame', () => {
    const moved = revealBox(start, { x: 300, y: 300, width: 2000, height: 2000 }, FRAME, 20);
    assert.equal(moved.x, 20 - 300);
    assert.equal(moved.y, 20 - 300);
  });
});

describe('viewportOn', () => {
  it('centres a box in the frame at full size when it is small', () => {
    const on = viewportOn({ x: 500, y: 300, width: 200, height: 100 }, FRAME, 20);
    assert.equal(on.scale, 1);
    assert.equal(500 * on.scale + on.x, (1000 - 200) / 2);
    assert.equal(300 * on.scale + on.y, (600 - 100) / 2);
  });

  it('shrinks to show a box too big for the frame', () => {
    const on = viewportOn({ x: 0, y: 0, width: 4000, height: 1000 }, FRAME, 20);
    assert.equal(on.scale, 0.24);
  });
});

describe('transformOf', () => {
  it('writes the viewport as a CSS transform', () => {
    assert.equal(transformOf({ x: 10, y: 20, scale: 0.5 }), 'translate(10px, 20px) scale(0.5)');
  });
});
