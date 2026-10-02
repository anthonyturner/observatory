import { nextIndex, previousIndex } from './playlist-order';

describe('playlist order', () => {
  it('steps forward, back to the first after the last', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });

  it('steps back, round to the last before the first', () => {
    expect(previousIndex(2, 3)).toBe(1);
    expect(previousIndex(0, 3)).toBe(2);
  });
});
