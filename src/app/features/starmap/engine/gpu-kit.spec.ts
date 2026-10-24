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
    const owned = new Owned();
    const marks = new Kit(document, owned).instanced(new PlaneGeometry(1, 1), batch);
    return { batch, owned, marks };
  };

  it('repeats the shape once per instance, with the batch arrays as its attributes', () => {
    const { batch, marks } = setUp();
    const { geometry } = marks;

    expect(geometry.instanceCount).toBe(3);
    expect(geometry.getAttribute('position').count).toBe(4);
    expect(geometry.getAttribute('aPos').array).toBe(batch.arrays.aPos);
    expect(geometry.getAttribute('aSize').array).toBe(batch.arrays.aSize);
  });

  it('sends only the attributes the frame rewrites', () => {
    const { marks } = setUp();
    const versions = () =>
      ['aPos', 'aSize'].map(
        (name) => (marks.geometry.getAttribute(name) as BufferAttribute).version,
      );
    const [pos, size] = versions();

    marks.upload();

    expect(versions()).toEqual([pos + 1, size]);
  });

  it('keeps its geometry while the batch fits its arrays, and sends every value again', () => {
    const { batch, marks } = setUp();
    const geometry = marks.geometry;
    const size = (geometry.getAttribute('aSize') as BufferAttribute).version;

    batch.resize(2);
    const synced = marks.sync();

    expect(synced).toBe(geometry);
    expect(synced.instanceCount).toBe(2);
    expect((synced.getAttribute('aSize') as BufferAttribute).version).toBe(size + 1);
  });

  it('swaps in a geometry for the new arrays when the batch outgrows them, freeing the old', () => {
    const { batch, owned, marks } = setUp();
    const geometry = marks.geometry;
    const resources = owned.size;

    batch.resize(10);
    const synced = marks.sync();

    expect(synced).not.toBe(geometry);
    expect(synced.instanceCount).toBe(10);
    expect(synced.getAttribute('aPos').array).toBe(batch.arrays.aPos);
    expect(owned.size).toBe(resources);
  });
});

describe('Owned', () => {
  it('frees one resource ahead of the rest, once', () => {
    const owned = new Owned();
    const dispose = vi.fn();
    const resource = owned.own({ dispose });

    owned.free(resource);
    owned.free(resource);

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(owned.size).toBe(0);
  });
});
