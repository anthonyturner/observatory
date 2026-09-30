import { tipPosition } from './tip-position';

describe('tipPosition', () => {
  const size = { width: 100, height: 40 };

  it('sits right of the pointer and above it', () => {
    expect(tipPosition({ x: 200, y: 300 }, size, 1280)).toEqual({ left: 214, top: 248 });
  });

  it('stays inside the window, dropping below the pointer near the top', () => {
    expect(tipPosition({ x: 1250, y: 30 }, size, 1280)).toEqual({ left: 1172, top: 46 });
  });
});
