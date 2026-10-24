import { Vector3 } from 'three';
import { place, vec } from './gpu-kit';

describe('place', () => {
  it('sets the vector it is given, flipping the sky down into scene up', () => {
    const target = new Vector3();

    expect(place(target, 3, 4, 5)).toBe(target);
    expect(target.toArray()).toEqual([3, -4, 5]);
  });

  it('is what vec builds a new vector from', () => {
    expect(vec(3, 4).toArray()).toEqual([3, -4, 0]);
  });
});
