import { Group, Line, Mesh, Scene } from 'three';
import { COOL_S, EMBER_SPAN_S } from '../memory/closed-ember';
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
    const handover = COLLAPSE_S / SQUASH_SPAN_S;

    effects.update([request('squashed', handover / 2)]);
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

    effects.update([request('squashed', 0.1, { still: true })]);
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
    const cooling = COOL_S / EMBER_SPAN_S / 2;

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

    effects.update([request('closed', 0.1, { still: true })]);
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

    effects.update([request('merged', 0.1)]);
    expect((scene.children[0] as Group).visible).toBe(true);

    effects.update([request('merged', 0.8)]);
    expect((scene.children[0] as Group).visible).toBe(false);
    expect(scene.children.some((child) => child instanceof Line)).toBe(true);
  });
});
