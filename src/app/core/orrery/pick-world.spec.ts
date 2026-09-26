import { pickWorld } from './pick-world';

describe('pickWorld', () => {
  it('finds the world under the pointer', () => {
    expect(pickWorld([{ key: 'a', x: 100, y: 100, radius: 30 }], 110, 90)).toBe('a');
  });

  it('gives a small world a forgiving target, but not an endless one', () => {
    const tiny = [{ key: 'tiny', x: 0, y: 0, radius: 3 }];

    expect(pickWorld(tiny, 15, 0)).toBe('tiny');
    expect(pickWorld(tiny, 25, 0)).toBeNull();
  });

  it('prefers the disc the pointer is on over a neighbour’s reach', () => {
    const drawn = [
      { key: 'big', x: 0, y: 0, radius: 40 },
      { key: 'small', x: 50, y: 0, radius: 5 },
    ];

    expect(pickWorld(drawn, 38, 0)).toBe('big');
  });

  it('takes the nearest when the pointer is on no disc', () => {
    const drawn = [
      { key: 'left', x: 0, y: 0, radius: 10 },
      { key: 'right', x: 30, y: 0, radius: 10 },
    ];

    expect(pickWorld(drawn, 18, 0)).toBe('right');
  });
});
