import { edgeToward } from './tether-layer';

describe('edgeToward', () => {
  const box = { left: 100, top: 100, right: 300, bottom: 200 };

  it('leaves from the side facing the point', () => {
    expect(edgeToward(box, 500, 150)).toEqual([300, 150]);
    expect(edgeToward(box, 200, 20)).toEqual([200, 100]);
  });

  it('leaves from the corner nearest a diagonal point', () => {
    expect(edgeToward(box, 0, 400)).toEqual([100, 200]);
  });

  it('points off the canvas toward a star past its edge', () => {
    expect(edgeToward(box, -900, 150)).toEqual([100, 150]);
  });

  it('draws nothing for a point under the window', () => {
    expect(edgeToward(box, 200, 150)).toBeNull();
  });
});
