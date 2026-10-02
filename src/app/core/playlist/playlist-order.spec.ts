import { nextIndex, pickShuffled, previousIndex } from './playlist-order';

describe('playlist order', () => {
  it('steps forward, back to the first after the last', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });

  it('steps back, round to the last before the first', () => {
    expect(previousIndex(2, 3)).toBe(1);
    expect(previousIndex(0, 3)).toBe(2);
  });

  it('deals the number asked for, each once, in an order the random source sets', () => {
    const pool = ['a', 'b', 'c', 'd', 'e'];
    const lastEachTime = () => 0.999;
    expect(pickShuffled(pool, 3, lastEachTime)).toEqual(['e', 'a', 'b']);
    expect(pickShuffled(pool, 3, () => 0)).toEqual(['a', 'b', 'c']);
  });

  it('deals the whole pool when asked for more than it holds, leaving the pool alone', () => {
    const pool = ['a', 'b'];
    expect(pickShuffled(pool, 5, Math.random).sort()).toEqual(['a', 'b']);
    expect(pool).toEqual(['a', 'b']);
  });
});
