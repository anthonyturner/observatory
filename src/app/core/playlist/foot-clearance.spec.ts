import { footClearanceOf, playlistReachOf } from './foot-clearance';

const NOTHING_ABOVE = { width: 0, height: 0 };
const VIDEO = { width: 356, height: 200 };

describe('footClearanceOf', () => {
  it('sets the tools beside a bar that takes half the window or less', () => {
    expect(footClearanceOf({ width: 560, height: 84 }, VIDEO, 1440)).toEqual({
      right: 560,
      bottom: 0,
    });
    expect(footClearanceOf({ width: 720, height: 84 }, VIDEO, 1440)).toEqual({
      right: 720,
      bottom: 0,
    });
  });

  it('stacks the tools above a bar wider than half the window, at the gutter', () => {
    expect(footClearanceOf({ width: 1150, height: 84 }, NOTHING_ABOVE, 1440)).toEqual({
      right: 20,
      bottom: 84,
    });
  });

  it('keeps the stacked tools short of the video floating over the bar', () => {
    expect(footClearanceOf({ width: 1150, height: 84 }, VIDEO, 1440)).toEqual({
      right: 396,
      bottom: 84,
    });
  });

  it('lifts the tools over the video where it leaves no room beside it, as on a phone', () => {
    expect(footClearanceOf({ width: 390, height: 120 }, VIDEO, 390)).toEqual({
      right: 20,
      bottom: 328,
    });
  });
});

describe('playlistReachOf', () => {
  it('reaches the top of the bar while nothing floats over it', () => {
    expect(playlistReachOf({ width: 560, height: 84 }, NOTHING_ABOVE)).toBe(84);
  });

  it('reaches the top of the video floating over the bar, and grows with it', () => {
    expect(playlistReachOf({ width: 560, height: 84 }, VIDEO)).toBe(292);
    expect(playlistReachOf({ width: 560, height: 84 }, { width: 576, height: 324 })).toBe(416);
  });
});
