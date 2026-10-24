import { Color } from 'three';

/** Attribute widths run from 1 to 3 floats. */
type Widths<K extends string> = Readonly<Record<K, 1 | 2 | 3>>;

/**
 * The per-instance values of one kind of mark, one array per attribute, laid
 * out as the GPU reads them. The scene draws the whole batch in one call, so
 * rewriting a value here is the only cost of changing a mark.
 */
export class InstanceBatch<K extends string> {
  private storage: Readonly<Record<K, Float32Array>>;
  private capacity: number;
  private live: number;

  /**
   * @param count how many instances the batch holds to begin with.
   * @param dynamic the attributes the frame rewrites; the rest are written
   *  once per layout and uploaded once.
   */
  constructor(
    count: number,
    readonly widths: Widths<K>,
    readonly dynamic: readonly NoInfer<K>[],
  ) {
    this.capacity = this.live = count;
    this.storage = this.allocate(count);
  }

  /** How many instances are drawn. */
  get count(): number {
    return this.live;
  }

  /** The arrays the GPU reads. They stay the same objects until the batch
   *  outgrows them, so a caller can tell a reallocation by their identity. */
  get arrays(): Readonly<Record<K, Float32Array>> {
    return this.storage;
  }

  /** Holds `count` instances from now on. The arrays are reallocated, with room
   *  to spare, only when they are too small, and then their values are lost: the
   *  caller writes every value again after a resize. */
  resize(count: number): void {
    if (count > this.capacity) {
      this.capacity = Math.max(count, Math.ceil(this.capacity * 1.5));
      this.storage = this.allocate(this.capacity);
    }
    this.live = count;
  }

  /** Writes the first `widths[name]` of the values to instance `index`. */
  set(name: K, index: number, a: number, b = 0, c = 0): void {
    const width = this.widths[name];
    const array = this.storage[name];
    const at = index * width;
    array[at] = a;
    if (width > 1) array[at + 1] = b;
    if (width > 2) array[at + 2] = c;
  }

  /** Writes a sky point, turning the sky's y-down into the scene's y-up as `place` does. */
  point(name: K, index: number, x: number, y: number, z: number): void {
    this.set(name, index, x, -y, z);
  }

  colour(name: K, index: number, colour: Color): void {
    this.set(name, index, colour.r, colour.g, colour.b);
  }

  private allocate(capacity: number): Record<K, Float32Array> {
    const arrays = {} as Record<K, Float32Array>;
    for (const name of Object.keys(this.widths) as K[]) {
      arrays[name] = new Float32Array(capacity * this.widths[name]);
    }
    return arrays;
  }
}
