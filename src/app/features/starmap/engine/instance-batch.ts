import { Color } from 'three';

/** Attribute widths run from 1 to 3 floats. */
type Widths<K extends string> = Readonly<Record<K, 1 | 2 | 3>>;

/**
 * The per-instance values of one kind of mark, one array per attribute, laid
 * out as the GPU reads them. The scene draws the whole batch in one call, so
 * rewriting a value here is the only cost of changing a mark.
 */
export class InstanceBatch<K extends string> {
  readonly arrays: Readonly<Record<K, Float32Array>>;

  /**
   * @param dynamic the attributes the frame rewrites; the rest are written
   *  once and uploaded once.
   */
  constructor(
    readonly count: number,
    readonly widths: Widths<K>,
    readonly dynamic: readonly NoInfer<K>[],
  ) {
    const arrays = {} as Record<K, Float32Array>;
    for (const name of Object.keys(widths) as K[]) {
      arrays[name] = new Float32Array(count * widths[name]);
    }
    this.arrays = arrays;
  }

  /** Writes the first `widths[name]` of the values to instance `index`. */
  set(name: K, index: number, a: number, b = 0, c = 0): void {
    const width = this.widths[name];
    const array = this.arrays[name];
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
}
