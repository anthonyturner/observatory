import { Points, Scene } from 'three';
import { CameraController } from './camera-controller';
import { Kit, Owned } from './gpu-kit';
import { SceneModel, buildScene3D } from './scene-3d';
import { SkyScene } from './sky-frame';
import { SkyLayout, buildField, layoutQueue } from './sky-layout';
import { SkyItem } from './sky-model';

const BUCKETS: SkyItem['bucket'][] = ['conflicted', 'unknown', 'unreviewed'];

/** A queue of `n` pull requests spread over three constellations, some with issues. */
const queue = (n: number, first = 1): SkyItem[] =>
  Array.from({ length: n }, (_, i) => ({
    pr: first + i,
    title: String(first + i),
    bucket: BUCKETS[i % BUCKETS.length],
    idleDays: i,
    additions: 40 + i * 30,
    deletions: 10,
    issues: i % 2 ? [i] : [],
  }));

const FIELD = buildField();

const sky = (items: SkyItem[], field = FIELD): SkyScene => {
  const layout = new SkyLayout();
  layoutQueue(items, layout);
  return { stars: layout.stars, clusters: layout.clusters, field };
};

beforeEach(() => {
  // jsdom has no 2D canvas; the cloud texture can go unpainted.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => vi.restoreAllMocks());

function setUp(): { scene: Scene; owned: Owned; model: SceneModel } {
  const scene = new Scene();
  const owned = new Owned();
  const camera = { current: { scale: 1 }, depth: () => 1 } as unknown as CameraController;
  return { scene, owned, model: buildScene3D(scene, new Kit(document, owned), camera) };
}

describe('the 3D scene on a data refresh', () => {
  it('keeps the same number of GPU resources across many refreshes of different sizes', () => {
    const { owned, scene, model } = setUp();
    // The largest layout first, so every pool has reached its size.
    model.load(sky(queue(60)));
    const resources = owned.size;
    const objects = scene.children.length;

    for (let refresh = 0; refresh < 50; refresh++) {
      model.load(sky(queue(5 + ((refresh * 7) % 56), refresh)));

      expect(owned.size).toBe(resources);
      expect(scene.children.length).toBe(objects);
    }
  });

  it('reuses every long-lived object, not only the count', () => {
    const { scene, model } = setUp();
    model.load(sky(queue(30)));
    const before = [...scene.children];

    model.load(sky(queue(20, 100)));
    model.load(sky(queue(30)));

    expect(scene.children).toEqual(before);
  });

  it('frees what a shrinking sky no longer needs, and gives it back when it grows again', () => {
    const { owned, model } = setUp();
    model.load(sky(queue(40)));
    const large = owned.size;

    model.load(sky([]));
    model.load(sky(queue(40, 500)));

    expect(owned.size).toBe(large);
  });

  it('draws the field once, however often the same field is handed back', () => {
    const { scene, model } = setUp();
    model.load(sky(queue(10)));
    const field = scene.children.find((child) => child instanceof Points) as Points;
    const geometry = field.geometry;

    model.load(sky(queue(12, 50)));
    expect(field.geometry).toBe(geometry);

    model.load(sky(queue(12, 50), buildField()));
    expect(field.geometry).not.toBe(geometry);
  });

  it('releases the old field when a new one replaces it', () => {
    const { owned, model } = setUp();
    model.load(sky(queue(10)));
    const resources = owned.size;

    model.load(sky(queue(10), buildField()));

    expect(owned.size).toBe(resources);
  });
});
