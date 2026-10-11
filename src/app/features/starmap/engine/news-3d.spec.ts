import { Group, Line, Mesh, Points, Scene } from 'three';
import { COOL_S, EMBER_SPAN_S } from '../memory/closed-ember';
import { PRELUDE_S } from '../memory/departure-exit';
import { MERGE_SPAN_S } from '../memory/merge-supernova';
import { COLLAPSE_S, SQUASH_SPAN_S } from '../memory/squash-collapse';
import { CameraController } from './camera-controller';
import { HOLE } from './black-hole';
import { Kit, Owned } from './gpu-kit';
import { NewsEffects3D } from './news-3d';
import { NewsEffect3D } from './sky-frame';

function setUp() {
  const scene = new Scene();
  const heads: [number, number][] = [];
  const effects = new NewsEffects3D({
    scene,
    kit: new Kit(document, new Owned()),
    camera: { current: { scale: 1 }, depth: () => 1 } as unknown as CameraController,
    toScreen: (x, y) => [x, y],
  });
  const key = {};
  const request = (
    mode: NewsEffect3D['mode'],
    p: number,
    extra: Partial<NewsEffect3D> = {},
  ): NewsEffect3D => ({
    key,
    mode,
    p,
    still: false,
    star: null,
    colour: '#ffffff',
    seed: 7,
    from: { x: HOLE.x + 600, y: HOLE.y, z: 40 },
    angle: 0,
    onHead: (head) => heads.push(head),
    ...extra,
  });
  return { scene, effects, request, heads };
}

describe('the squash collapse in 3D', () => {
  it('shows the collapsing star where it stood, then hands over to the streak', () => {
    const { scene, effects, request } = setUp();
    const collapsing = (PRELUDE_S + COLLAPSE_S / 2) / SQUASH_SPAN_S;

    effects.update([request('squashed', collapsing)]);
    const [group] = scene.children as Group[];
    expect(group.visible).toBe(true);
    expect(group.position.x).toBe(HOLE.x + 600);
    expect(scene.children.some((child) => child instanceof Line)).toBe(false);

    effects.update([request('squashed', 0.8)]);
    expect(group.visible).toBe(false);
    expect(scene.children.some((child) => child instanceof Line)).toBe(true);
  });

  it('keeps the ring and the streak out when motion is off', () => {
    const { scene, effects, request } = setUp();

    effects.update([request('squashed', (PRELUDE_S + 0.1) / SQUASH_SPAN_S, { still: true })]);
    const group = scene.children[0] as Group;
    const meshes = group.children as Mesh[];
    expect(meshes.filter((mesh) => mesh.visible)).toHaveLength(2);

    effects.update([request('squashed', 0.8, { still: true })]);
    expect(scene.children.some((child) => child instanceof Line)).toBe(false);
  });

  it('releases everything once the burst is over', () => {
    const { scene, effects, request } = setUp();

    effects.update([request('squashed', 0.8)]);
    effects.update([]);

    expect(scene.children).toEqual([]);
  });
});

describe('the closed ember in 3D', () => {
  it('cools where the star stood, then sinks toward the hole, naming its place for the label', () => {
    const { scene, effects, request, heads } = setUp();
    const cooling = (PRELUDE_S + COOL_S / 2) / EMBER_SPAN_S;

    effects.update([request('closed', cooling)]);
    const group = scene.children[0] as Group;
    expect(group.visible).toBe(true);
    expect(group.position.x).toBe(HOLE.x + 600);
    expect(heads.at(-1)).toEqual([HOLE.x + 600, HOLE.y]);

    effects.update([request('closed', 0.7)]);
    expect(group.visible).toBe(true);
    expect(Math.abs(group.position.x - HOLE.x)).toBeLessThan(600);
    expect(Math.abs((heads.at(-1)?.[0] ?? 0) - HOLE.x)).toBeLessThan(600);
  });

  it('only cools when motion is off', () => {
    const { scene, effects, request } = setUp();

    effects.update([request('closed', (PRELUDE_S + 0.1) / EMBER_SPAN_S, { still: true })]);
    const group = scene.children[0] as Group;
    expect(group.visible).toBe(true);

    effects.update([request('closed', 0.7, { still: true })]);
    expect(group.visible).toBe(false);
  });

  it('releases everything once the burst is over', () => {
    const { scene, effects, request } = setUp();

    effects.update([request('closed', 0.7)]);
    effects.update([]);

    expect(scene.children).toEqual([]);
  });
});

describe('the merge supernova in 3D', () => {
  it('still goes off, then streaks, as it did before the other exits', () => {
    const { scene, effects, request } = setUp();

    effects.update([request('merged', (PRELUDE_S + 0.1) / MERGE_SPAN_S)]);
    expect((scene.children[0] as Group).visible).toBe(true);

    effects.update([request('merged', 0.8)]);
    expect((scene.children[0] as Group).visible).toBe(false);
    expect(scene.children.some((child) => child instanceof Line)).toBe(true);
  });
});

describe('review-thread sparks in 3D', () => {
  const flying = [
    { unresolved: true, x: 1, y: 2, z: 3, alpha: 1, size: 3 },
    { unresolved: false, x: 4, y: 5, z: 6, alpha: 0.5, size: 2 },
  ];

  it.each(['merged', 'squashed', 'closed'] as const)(
    'draws a %s exit’s sparks as points in red and gold, upright in the scene',
    (mode) => {
      const { scene, effects, request } = setUp();

      effects.update([request(mode, 0.2, { sparks: flying })]);

      const points = scene.children.find((child) => child instanceof Points) as Points;
      const position = points.geometry.attributes['position'];
      const colour = points.geometry.attributes['color'];
      expect(points.geometry.drawRange.count).toBe(2);
      expect([position.getX(0), position.getY(0), position.getZ(0)]).toEqual([1, -2, 3]);
      expect(colour.getX(0)).toBeGreaterThan(colour.getZ(0));
      expect(colour.getX(1)).toBeGreaterThan(colour.getZ(1));
      expect(colour.getY(1)).toBeGreaterThan(colour.getY(0));
    },
  );

  it('builds no points for an exit with no sparks, and shows none once they have landed', () => {
    const { scene, effects, request } = setUp();

    effects.update([request('merged', 0.2)]);
    expect(scene.children.some((child) => child instanceof Points)).toBe(false);

    effects.update([request('merged', 0.3, { sparks: flying })]);
    effects.update([request('merged', 0.9, { sparks: [] })]);
    const points = scene.children.find((child) => child instanceof Points) as Points;
    expect(points.geometry.drawRange.count).toBe(0);
  });

  it('releases the points with the exit', () => {
    const { scene, effects, request } = setUp();

    effects.update([request('closed', 0.2, { sparks: flying })]);
    effects.update([]);

    expect(scene.children).toEqual([]);
  });
});
