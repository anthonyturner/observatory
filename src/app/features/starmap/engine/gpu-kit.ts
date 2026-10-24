import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Material,
  Object3D,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Texture,
  Vector3,
} from 'three';
import { InstanceBatch } from './instance-batch';

/* The GPU tool box the 3D sky and its effects share. */

export interface Disposable {
  dispose(): void;
}

/** The GPU resources a scene owns, released together when it is rebuilt. */
export class Owned {
  private readonly resources = new Set<Disposable>();

  /** How many resources are held; a scene that updates in place keeps it steady. */
  get size(): number {
    return this.resources.size;
  }

  own<T extends Disposable>(resource: T): T {
    this.resources.add(resource);
    return resource;
  }

  /** Releases one resource ahead of the rest. Freeing one already freed is fine. */
  free(resource: Disposable): void {
    if (this.resources.delete(resource)) resource.dispose();
  }

  release(root: Object3D): void {
    root.traverse((o) => {
      const mesh = o as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
      if (mesh.geometry) {
        mesh.geometry.dispose();
        this.resources.delete(mesh.geometry);
      }
      if (mesh.material) {
        for (const m of [mesh.material].flat()) {
          m.dispose();
          this.resources.delete(m);
        }
      }
    });
    root.removeFromParent();
  }

  disposeAll(): void {
    for (const resource of this.resources) resource.dispose();
    this.resources.clear();
  }
}

/** Sets `target` to a sky point, turning the sky's y-down into the scene's y-up. */
export const place = (target: Vector3, x: number, y: number, z = 0): Vector3 =>
  target.set(x, -y, z);

export const vec = (x: number, y: number, z = 0): Vector3 => place(new Vector3(), x, y, z);

/**
 * A shape drawn once per instance of a batch, with the batch's arrays as its
 * attributes. The geometry follows the batch: it is rebuilt only when the batch
 * grew past its arrays, and otherwise just told to send them again.
 */
export class Instanced<K extends string> {
  private built: object;
  private moving: InstancedBufferAttribute[] = [];
  private current: InstancedBufferGeometry;

  constructor(
    private readonly owned: Owned,
    private readonly base: BufferGeometry,
    private readonly batch: InstanceBatch<K>,
  ) {
    this.built = batch.arrays;
    this.current = this.owned.own(this.build());
    this.current.instanceCount = batch.count;
  }

  get geometry(): InstancedBufferGeometry {
    return this.current;
  }

  /** Follows the batch after it was laid out again, and returns the geometry to
   *  draw; every value is sent, as the layout rewrote them all. */
  sync(): InstancedBufferGeometry {
    const { batch } = this;
    if (this.built !== batch.arrays) {
      this.owned.free(this.current);
      this.current = this.owned.own(this.build());
      this.built = batch.arrays;
    } else {
      for (const name of Object.keys(batch.widths)) {
        this.current.getAttribute(name).needsUpdate = true;
      }
    }
    this.current.instanceCount = batch.count;
    return this.current;
  }

  /** Sends the values the frame rewrote to the GPU. */
  upload(): void {
    for (const attribute of this.moving) attribute.needsUpdate = true;
  }

  private build(): InstancedBufferGeometry {
    const { base, batch } = this;
    const geometry = new InstancedBufferGeometry();
    // Copies, so that freeing this geometry leaves the buffers of the others alone.
    geometry.index = base.index?.clone() ?? null;
    for (const [name, attribute] of Object.entries(base.attributes)) {
      geometry.setAttribute(name, attribute.clone());
    }
    this.moving = [];
    for (const name of Object.keys(batch.widths) as K[]) {
      const attribute = new InstancedBufferAttribute(batch.arrays[name], batch.widths[name]);
      if (batch.dynamic.includes(name)) {
        attribute.setUsage(DynamicDrawUsage);
        this.moving.push(attribute);
      }
      geometry.setAttribute(name, attribute);
    }
    return geometry;
  }
}

/** One tool box for the scene builders: textures, sprites and lines it owns. */
export class Kit {
  constructor(
    readonly document: Document,
    readonly owned: Owned,
  ) {}

  texture(paint: (c: CanvasRenderingContext2D, size: number) => void, size = 128): Texture {
    const cv = this.document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    if (c) paint(c, size);
    const map = this.owned.own(new CanvasTexture(cv));
    map.colorSpace = SRGBColorSpace;
    return map;
  }

  sprite(map: Texture, colour = '#ffffff', opacity = 1): Sprite {
    const material = this.owned.own(
      new SpriteMaterial({
        map,
        color: colour,
        opacity,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    return new Sprite(material);
  }

  line(points: Vector3[], colour: string, opacity = 1, dashed = false): Line {
    const geometry = this.owned.own(new BufferGeometry().setFromPoints(points));
    const opts = { color: colour, transparent: true, opacity, depthWrite: false };
    const material = this.owned.own(
      dashed
        ? new LineDashedMaterial({ ...opts, dashSize: 7, gapSize: 9 })
        : new LineBasicMaterial(opts),
    );
    const object = new Line(geometry, material);
    if (dashed) object.computeLineDistances();
    return object;
  }

  /** `base` repeated for every instance in `batch`, whose arrays become the attributes. */
  instanced<K extends string>(base: BufferGeometry, batch: InstanceBatch<K>): Instanced<K> {
    return new Instanced(this.owned, base, batch);
  }

  /** Unjoined segments, one per pair of points. */
  segments(points: Vector3[], colour: string, opacity = 1): LineSegments {
    const geometry = this.owned.own(new BufferGeometry().setFromPoints(points));
    const material = this.owned.own(
      new LineBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false }),
    );
    return new LineSegments(geometry, material);
  }
}
