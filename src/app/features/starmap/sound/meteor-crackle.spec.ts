import { crackleOf } from './meteor-crackle';

describe('crackleOf', () => {
  it('crackles in more pops for a bigger change, each softer than the last', () => {
    const small = crackleOf(0.1, 7);
    const big = crackleOf(1, 7);

    expect(big.length).toBeGreaterThan(small.length);
    big.slice(1).forEach((pop, i) => expect(pop.level).toBeLessThan(big[i].level));
  });

  it('stays quiet, short and in the sizzle’s register', () => {
    for (const pop of crackleOf(1, 412)) {
      expect(pop.level).toBeGreaterThan(0);
      expect(pop.level).toBeLessThanOrEqual(0.03);
      expect(pop.at).toBeLessThan(0.4);
      expect(pop.decay).toBeLessThan(0.07);
      expect(pop.freq).toBeGreaterThan(3000);
    }
  });

  it('sounds the same for the same pull request every time', () => {
    expect(crackleOf(0.5, 99)).toEqual(crackleOf(0.5, 99));
    expect(crackleOf(0.5, 99)).not.toEqual(crackleOf(0.5, 100));
  });
});
