import { Color, Mesh, Scene, ShaderMaterial, Texture, Vector3 } from 'three';
import { EARTH_RADIUS } from '../../../../core/orrery/earth';
import { EarthBody } from './earth-body';

const textures = () => ({ day: new Texture(), night: new Texture(), clouds: new Texture() });
const materialsOf = (earth: EarthBody): ShaderMaterial[] =>
  earth.group.children.map((child) => (child as Mesh<never, ShaderMaterial>).material);

describe('EarthBody', () => {
  it('sits at the orbit origin, ground, clouds and air one inside the next', () => {
    const earth = new EarthBody(textures(), new Color());
    const radii = earth.group.children.map((child) => child.scale.x);

    expect(earth.group.position.toArray()).toEqual([0, 0, 0]);
    expect(radii[0]).toBe(EARTH_RADIUS);
    expect(radii[0]).toBeLessThan(radii[1]);
    expect(radii[1]).toBeLessThan(radii[2]);
  });

  it('lights the ground, the clouds and the air from the sun position it is given', () => {
    const earth = new EarthBody(textures(), new Color());
    const scene = new Scene();

    earth.attachTo(scene, new Vector3(-900, 500, -300));

    for (const material of materialsOf(earth)) {
      expect((material.uniforms['sun'].value as Vector3).toArray()).toEqual([-900, 500, -300]);
    }
    expect(earth.group.parent).toBe(scene);
  });

  it('moves into a new scene, and out of the old one, when the worlds are rebuilt', () => {
    const earth = new EarthBody(textures(), new Color());
    const first = new Scene();
    const second = new Scene();
    earth.attachTo(first, new Vector3(-900, 500, 0));

    earth.attachTo(second, new Vector3(-1000, 600, 0));

    expect(first.children).not.toContain(earth.group);
    expect(second.children).toContain(earth.group);
    expect((materialsOf(earth)[0].uniforms['sun'].value as Vector3).x).toBe(-1000);
  });

  it('turns its clouds against a ground that holds still', () => {
    const earth = new EarthBody(textures(), new Color());
    const [ground, clouds] = earth.group.children;

    earth.update(0);
    const start = clouds.rotation.y;
    earth.update(10);

    expect(clouds.rotation.y).toBeGreaterThan(start);
    expect(ground.rotation.y).toBe(start);
    expect(materialsOf(earth)[0].uniforms['cloudTurn'].value).toBeCloseTo(
      ground.rotation.y - clouds.rotation.y,
    );
  });

  it('releases its textures and materials when disposed, and leaves the scene', () => {
    const set = textures();
    const earth = new EarthBody(set, new Color());
    const scene = new Scene();
    earth.attachTo(scene, new Vector3());
    const released: string[] = [];
    set.day.addEventListener('dispose', () => released.push('day'));
    set.clouds.addEventListener('dispose', () => released.push('clouds'));

    earth.dispose();

    expect(released).toEqual(['day', 'clouds']);
    expect(scene.children).toEqual([]);
  });
});
