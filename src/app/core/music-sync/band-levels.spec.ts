import { bandLevels } from './band-levels';

/** 1024 bins of 20 Hz each, loud from `fromHz` to `toHz`. */
function spectrum(fromHz: number, toHz: number): Uint8Array {
  const bins = new Uint8Array(1024);
  for (let i = Math.floor(fromHz / 20); i <= Math.ceil(toHz / 20); i++) bins[i] = 255;
  return bins;
}

describe('bandLevels', () => {
  it('hears a kick as bass alone', () => {
    const levels = bandLevels(spectrum(30, 150), 20);
    expect(levels.bass).toBeCloseTo(1, 1);
    expect(levels.mid).toBeLessThan(0.05);
    expect(levels.high).toBe(0);
  });

  it('hears hats as highs alone', () => {
    const levels = bandLevels(spectrum(4000, 12000), 20);
    expect(levels.high).toBeCloseTo(1, 1);
    expect(levels.bass).toBe(0);
  });

  it('hears silence as nothing', () => {
    expect(bandLevels(new Uint8Array(1024), 20)).toEqual({ bass: 0, mid: 0, high: 0 });
  });
});
