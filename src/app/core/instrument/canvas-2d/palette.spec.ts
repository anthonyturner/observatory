import { parseRgb, rgbCss } from './palette';

describe('palette colours', () => {
  it('reads a computed rgb() colour as channels', () => {
    expect(parseRgb('rgb(255, 0, 51)')).toEqual([1, 0, 0.2]);
    expect(parseRgb('rgba(0 255 0 / 0.5)')).toEqual([0, 1, 0]);
  });

  it('falls back to white for a colour it cannot read', () => {
    expect(parseRgb('color(display-p3 1 0 0)')).toEqual([1, 1, 1]);
  });

  it('writes channels back as CSS, optionally dimmed', () => {
    expect(rgbCss([1, 0.5, 0])).toBe('rgb(255 128 0)');
    expect(rgbCss([1, 1, 1], 0.5)).toBe('rgb(128 128 128)');
  });
});
