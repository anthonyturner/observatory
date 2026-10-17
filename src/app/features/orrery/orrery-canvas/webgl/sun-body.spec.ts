import { Color, Scene, SphereGeometry } from 'three';
import { Owned } from '../../../starmap/engine/gpu-kit';
import { SunPlacement } from '../../../../core/orrery/sun-placement';
import { buildSun } from './sun-body';

const placement: SunPlacement = { x: -640, y: -370, z: 0, distance: 740, radius: 50 };

describe('buildSun', () => {
  const scene = new Scene();
  const sun = buildSun(scene, placement, new Color('#ffd9a0'), new SphereGeometry(1), new Owned());

  it('puts the light, the body and the corona at the placement, y up as the scene has it', () => {
    for (const at of [sun.position, sun.light.position, sun.body.position, sun.corona.position]) {
      expect(at.toArray()).toEqual([-640, 370, 0]);
    }
    expect(sun.coronaMaterial.uniforms['centre'].value).toBe(sun.position);
  });

  it('keeps the sun’s size, with the corona reaching beyond it', () => {
    expect(sun.body.scale.x).toBe(50);
    expect(sun.coronaMaterial.uniforms['radius'].value).toBe(50);
    expect((sun.corona.geometry as SphereGeometry).parameters.radius).toBeGreaterThan(50);
  });

  it('adds all three to the scene', () => {
    expect(scene.children).toEqual(expect.arrayContaining([sun.light, sun.body, sun.corona]));
  });
});
