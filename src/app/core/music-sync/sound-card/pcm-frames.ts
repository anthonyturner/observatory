const BYTES_PER_SAMPLE = 4;

/** The whole frames in a run of bytes, and the part-frame left over for next time. */
export interface SplitFrames {
  /** Interleaved samples, every channel of each whole frame. */
  readonly samples: Float32Array<ArrayBuffer>;
  readonly rest: Uint8Array<ArrayBuffer>;
}

/**
 * `rest` and then `chunk` read as little-endian 32-bit float frames of
 * `channels` samples. A network stream splits its bytes anywhere, even
 * mid-sample, so whatever does not make a whole frame waits for the next chunk.
 */
export function splitFrames(rest: Uint8Array, chunk: Uint8Array, channels: number): SplitFrames {
  const bytes = new Uint8Array(rest.length + chunk.length);
  bytes.set(rest);
  bytes.set(chunk, rest.length);
  const frameBytes = channels * BYTES_PER_SAMPLE;
  const wholeBytes = bytes.length - (bytes.length % frameBytes);
  const view = new DataView(bytes.buffer, 0, wholeBytes);
  const samples = new Float32Array(wholeBytes / BYTES_PER_SAMPLE);
  for (let index = 0; index < samples.length; index++) {
    samples[index] = view.getFloat32(index * BYTES_PER_SAMPLE, true);
  }
  return { samples, rest: bytes.slice(wholeBytes) };
}
