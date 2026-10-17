import { isOccluded, pickWorld, splitAtDepth } from './pick-world';

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

describe('isOccluded', () => {
  const earth = { x: 0, y: 0, z: 0, radius: 40 };
  const sun = { x: -300, y: -150, z: -400, radius: 60 };

  it('hides a world behind a disc and inside its edge', () => {
    expect(isOccluded({ x: 10, y: 10, z: -50 }, [earth, sun])).toBe(true);
    expect(isOccluded({ x: -310, y: -140, z: -900 }, [earth, sun])).toBe(true);
  });

  it('leaves a world in front of the disc, or outside it, alone', () => {
    expect(isOccluded({ x: 10, y: 10, z: 50 }, [earth, sun])).toBe(false);
    expect(isOccluded({ x: 100, y: 0, z: -50 }, [earth, sun])).toBe(false);
    expect(isOccluded({ x: -310, y: -140, z: -100 }, [earth, sun])).toBe(false);
  });

  it('hides nothing when nothing stands in the way', () => {
    expect(isOccluded({ x: 0, y: 0, z: -50 }, [])).toBe(false);
  });
});

describe('splitAtDepth', () => {
  const near = { key: 'near', z: 30 };
  const level = { key: 'level', z: 0 };
  const far = { key: 'far', z: -30 };

  it('puts what lies behind the depth apart from what is level with it or in front', () => {
    const { behind, inFront } = splitAtDepth([near, far, level], 0);

    expect(behind).toEqual([far]);
    expect(inFront).toEqual([near, level]);
  });

  it('agrees with isOccluded about which side a world is on', () => {
    const disc = { x: 0, y: 0, z: 0, radius: 40 };
    const { behind } = splitAtDepth([near, level, far], disc.z);

    for (const world of [near, level, far]) {
      const hidden = isOccluded({ x: 0, y: 0, z: world.z }, [disc]);
      expect(behind.includes(world)).toBe(hidden);
    }
  });

  it('has nothing behind when nothing is', () => {
    expect(splitAtDepth([near], 0)).toEqual({ behind: [], inFront: [near] });
  });
});
