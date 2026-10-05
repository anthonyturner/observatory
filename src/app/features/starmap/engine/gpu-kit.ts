import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
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

/* The GPU tool box the 3D sky and its effects share. */

export interface Disposable {
  dispose(): void;
}

/** The GPU resources a scene owns, released together when it is rebuilt. */
export class Owned {
  private readonly resources = new Set<Disposable>();

  own<T extends Disposable>(resource: T): T {
    this.resources.add(resource);
    return resource;
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

export const vec = (x: number, y: number, z = 0): Vector3 => new Vector3(x, -y, z);

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

  /** Unjoined segments, one per pair of points. */
  segments(points: Vector3[], colour: string, opacity = 1): LineSegments {
    const geometry = this.owned.own(new BufferGeometry().setFromPoints(points));
    const material = this.owned.own(
      new LineBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false }),
    );
    return new LineSegments(geometry, material);
  }
}
