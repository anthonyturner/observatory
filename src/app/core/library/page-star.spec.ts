import { starDiameterOf } from './page-star';

describe('starDiameterOf', () => {
  it('grows with a page’s length on a log scale, between a floor and a ceiling', () => {
    expect(starDiameterOf(0)).toBe(4);
    expect(starDiameterOf(100)).toBe(6);
    expect(starDiameterOf(1000)).toBe(10);
    expect(starDiameterOf(50_000)).toBe(13);
    expect(starDiameterOf(-5)).toBe(4);
  });
});
