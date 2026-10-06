import { splitFrames } from './pcm-frames';

/** `values` as little-endian 32-bit floats, the way the stream sends them. */
function bytesOf(...values: number[]): Uint8Array {
  const view = new DataView(new ArrayBuffer(values.length * 4));
  values.forEach((value, index) => view.setFloat32(index * 4, value, true));
  return new Uint8Array(view.buffer);
}

describe('splitFrames', () => {
  it('reads whole stereo frames as interleaved samples', () => {
    const split = splitFrames(new Uint8Array(0), bytesOf(0.5, -0.5, 0.25, -0.25), 2);

    expect([...split.samples]).toEqual([0.5, -0.5, 0.25, -0.25]);
    expect(split.rest.length).toBe(0);
  });

  it('keeps a part-frame, even one cut mid-sample, for the next chunk', () => {
    const bytes = bytesOf(0.5, -0.5, 0.25, -0.25);
    const first = splitFrames(new Uint8Array(0), bytes.subarray(0, 13), 2);
    const second = splitFrames(first.rest, bytes.subarray(13), 2);

    expect([...first.samples]).toEqual([0.5, -0.5]);
    expect(first.rest.length).toBe(5);
    expect([...second.samples]).toEqual([0.25, -0.25]);
    expect(second.rest.length).toBe(0);
  });

  it('gives no samples until a whole frame has come', () => {
    const split = splitFrames(new Uint8Array(0), bytesOf(0.5), 2);

    expect(split.samples.length).toBe(0);
    expect(split.rest.length).toBe(4);
  });
});
