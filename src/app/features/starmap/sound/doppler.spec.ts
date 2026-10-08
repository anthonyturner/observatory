import { closingSpeed, dopplerFactor, dopplerOf, listenerOf } from './doppler';

const at = (x: number, y: number, z = 0) => ({ x, y, z });

describe('listenerOf', () => {
  it('stands at the middle of the bottom edge, in front of the screen', () => {
    expect(listenerOf(1000, 800)).toEqual({ x: 500, y: 800, z: 400 });
  });
});

describe('closingSpeed', () => {
  const listener = at(0, 0, 0);

  it('is positive when the thing draws nearer, negative when it draws away', () => {
    expect(closingSpeed(at(100, 0), at(60, 0), 1, listener)).toBe(40);
    expect(closingSpeed(at(60, 0), at(100, 0), 1, listener)).toBe(-40);
  });

  it('counts depth as well as screen motion', () => {
    expect(closingSpeed(at(0, 0, 0), at(0, 0, 30), 1, at(0, 0, 100))).toBe(30);
  });

  it('is zero for something that held still, or for no time at all', () => {
    expect(closingSpeed(at(5, 5), at(5, 5), 1, listener)).toBe(0);
    expect(closingSpeed(at(100, 0), at(0, 0), 0, listener)).toBe(0);
    expect(closingSpeed(at(100, 0), at(0, 0), -1, listener)).toBe(0);
  });

  it('ignores motion across the line of sight', () => {
    expect(closingSpeed(at(0, 100), at(0.01, 100), 1, listener)).toBeCloseTo(0, 3);
  });
});

describe('dopplerFactor', () => {
  it('is 1 when nothing closes or recedes', () => {
    expect(dopplerFactor(0)).toBe(1);
  });

  it('rises on approach and falls on retreat, by the same musical amount', () => {
    expect(dopplerFactor(300)).toBeGreaterThan(1);
    expect(dopplerFactor(-300)).toBeLessThan(1);
    expect(dopplerFactor(300) * dopplerFactor(-300)).toBeCloseTo(1);
  });

  it('never goes past three semitones either way, however fast', () => {
    const top = 2 ** (3 / 12);
    expect(dopplerFactor(1e9)).toBeCloseTo(top);
    expect(dopplerFactor(-1e9)).toBeCloseTo(1 / top);
    expect(dopplerFactor(Infinity)).toBeCloseTo(top);
    expect(dopplerFactor(600)).toBeCloseTo(top);
    expect(dopplerFactor(NaN)).toBe(1);
  });
});

describe('dopplerOf', () => {
  it('is the factor of the speed between two drawn places', () => {
    const listener = at(0, 0, 0);
    expect(dopplerOf(at(100, 0), at(70, 0), 0.5, listener)).toBe(dopplerFactor(60));
    expect(dopplerOf(at(9, 9), at(9, 9), 0.5, listener)).toBe(1);
  });
});
