import { BufferAttribute, PlaneGeometry, Vector3 } from 'three';
import { Kit, Owned, place, vec } from './gpu-kit';
import { InstanceBatch } from './instance-batch';

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

describe('Kit.instanced', () => {
  const setUp = () => {
    const batch = new InstanceBatch(3, { aPos: 3, aSize: 1 }, ['aPos']);
    return { batch, ...new Kit(document, new Owned()).instanced(new PlaneGeometry(1, 1), batch) };
  };

  it('repeats the shape once per instance, with the batch arrays as its attributes', () => {
    const { batch, geometry } = setUp();

    expect(geometry.instanceCount).toBe(3);
    expect(geometry.getAttribute('position').count).toBe(4);
    expect(geometry.getAttribute('aPos').array).toBe(batch.arrays.aPos);
    expect(geometry.getAttribute('aSize').array).toBe(batch.arrays.aSize);
  });

  it('sends only the attributes the frame rewrites', () => {
    const { geometry, upload } = setUp();
    const versions = () =>
      ['aPos', 'aSize'].map((name) => (geometry.getAttribute(name) as BufferAttribute).version);
    const [pos, size] = versions();

    upload();

    expect(versions()).toEqual([pos + 1, size]);
  });
});
