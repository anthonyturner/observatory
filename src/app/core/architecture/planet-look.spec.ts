import { WORLD_KINDS } from '../orrery/world-kind';
import { planetLook } from './planet-look';

describe('planetLook', () => {
  it('gives a node the same kind and surface on every load', () => {
    const id = 'src/app/core/orrery/orbit.ts#growth';
    expect(planetLook(id, 10, 20)).toEqual(planetLook(id, 10, 20));
  });

  it('keeps the kind and surface wherever the node sits on its orbit', () => {
    const a = planetLook('ArchitectureFeed', 100, 0);
    const b = planetLook('ArchitectureFeed', 0, -100);
    expect([b.kind, b.seed]).toEqual([a.kind, a.seed]);
  });

  it('uses every kind across a spread of nodes', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `Service${i}`);
    expect(new Set(ids.map((id) => planetLook(id, 1, 1).kind))).toEqual(new Set(WORLD_KINDS));
  });

  it('lights each planet from the sun at the centre', () => {
    expect(planetLook('a', 30, -40).towardSun).toEqual({ x: -0.6, y: 0.8 });
    expect(planetLook('a', -24, -7).towardSun).toEqual({ x: 0.96, y: 0.28 });
  });
});
