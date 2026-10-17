import { CLICK_SLOP_PX, grabRadius, isClick, routePress } from './press-route';

const EARTH = { x: 400, y: 300, radius: 60 };

describe('routePress', () => {
  it('turns the Earth for a press on its disc', () => {
    expect(routePress(400, 300, EARTH)).toBe('spin-earth');
    expect(routePress(455, 300, EARTH)).toBe('spin-earth');
  });

  it('pans for a press anywhere else', () => {
    expect(routePress(500, 300, EARTH)).toBe('pan');
    expect(routePress(10, 10, EARTH)).toBe('pan');
  });

  it('lets a finger grab an Earth that is small on a phone', () => {
    const small = { x: 200, y: 400, radius: 8 };

    expect(routePress(218, 400, small)).toBe('spin-earth');
    expect(routePress(240, 400, small)).toBe('pan');
    expect(grabRadius(8)).toBeGreaterThan(8);
    expect(grabRadius(60)).toBe(60);
  });
});

describe('isClick', () => {
  it('counts a press that barely moved as a click', () => {
    expect(isClick(0)).toBe(true);
    expect(isClick(CLICK_SLOP_PX - 1)).toBe(true);
  });

  it('does not count a drag that turned the Earth as a click', () => {
    const turned = routePress(420, 310, EARTH) === 'spin-earth';

    expect(turned).toBe(true);
    expect(isClick(80)).toBe(false);
    expect(isClick(CLICK_SLOP_PX)).toBe(false);
  });
});
