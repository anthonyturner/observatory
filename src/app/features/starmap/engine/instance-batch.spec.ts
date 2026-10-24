import { Color } from 'three';
import { InstanceBatch } from './instance-batch';

const batch = () => new InstanceBatch(2, { aPos: 3, aSize: 1, aFade: 2 }, ['aPos']);

describe('InstanceBatch', () => {
  it('holds one array per attribute, sized to its width and the instance count', () => {
    const { arrays } = batch();

    expect(arrays.aPos.length).toBe(6);
    expect(arrays.aSize.length).toBe(2);
    expect(arrays.aFade.length).toBe(4);
  });

  it('writes only as many values as the attribute is wide, at its own instance', () => {
    const b = batch();

    b.set('aFade', 1, 0.25, 0.5, 0.75);
    b.set('aSize', 0, 9, 8, 7);

    expect(Array.from(b.arrays.aFade)).toEqual([0, 0, 0.25, 0.5]);
    expect(Array.from(b.arrays.aSize)).toEqual([9, 0]);
  });

  it('turns a sky point y-down into the scene y-up, as place does', () => {
    const b = batch();

    b.point('aPos', 1, 3, 4, 5);

    expect(Array.from(b.arrays.aPos)).toEqual([0, 0, 0, 3, -4, 5]);
  });

  it('writes a colour as its red, green and blue', () => {
    const b = new InstanceBatch(1, { aInk: 3 }, []);

    b.colour('aInk', 0, new Color(1, 0.5, 0.25));

    expect(Array.from(b.arrays.aInk)).toEqual([1, 0.5, 0.25]);
  });
});
