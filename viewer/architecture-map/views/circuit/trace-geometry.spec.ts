import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { arrowHeadPoints, lengthOf, midpointOf, roundedPath } from './trace-geometry.ts';

describe('roundedPath', () => {
  it('draws a straight route as one line', () => {
    assert.equal(
      roundedPath(
        [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
        ],
        6,
      ),
      'M0 0 L40 0',
    );
  });

  it('rounds a right-angled corner with a curve that ends on the route', () => {
    const path = roundedPath(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 30 },
      ],
      6,
    );
    assert.equal(path, 'M0 0 L34 0 Q40 0 40 6 L40 30');
  });

  it('never rounds past the middle of a short segment', () => {
    const path = roundedPath(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 40 },
      ],
      10,
    );
    assert.equal(path, 'M0 0 L2 0 Q4 0 4 2 L4 40');
  });

  it('ignores repeated points and an empty route', () => {
    assert.equal(
      roundedPath(
        [
          { x: 1, y: 1 },
          { x: 1, y: 1 },
          { x: 9, y: 1 },
        ],
        6,
      ),
      'M1 1 L9 1',
    );
    assert.equal(roundedPath([], 6), '');
  });
});

describe('lengthOf', () => {
  it('adds up the segments of a route', () => {
    assert.equal(
      lengthOf([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 30 },
      ]),
      40,
    );
    assert.equal(lengthOf([]), 0);
  });
});

describe('midpointOf', () => {
  it('finds the middle by length, not by point count', () => {
    const route = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 30 },
    ];
    assert.deepEqual(midpointOf(route), { x: 10, y: 10 });
  });

  it('copes with one point and none', () => {
    assert.deepEqual(midpointOf([{ x: 5, y: 7 }]), { x: 5, y: 7 });
    assert.deepEqual(midpointOf([]), { x: 0, y: 0 });
  });
});

describe('arrowHeadPoints', () => {
  it('points its tip at the end of the route, along the last segment', () => {
    const points = arrowHeadPoints(
      [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ],
      10,
    );
    const [tip, first, second] = points.split(' ');
    assert.equal(tip, '50,0');
    assert.equal(first, '40,-5.5');
    assert.equal(second, '40,5.5');
  });

  it('has no head for a route with no length', () => {
    assert.equal(arrowHeadPoints([{ x: 3, y: 3 }], 10), '');
  });
});
