import { WORLD_KINDS } from '../../core/orrery/world-kind';
import { CLOUD_FRAGMENT, SURFACE_FRAGMENT, kindDefines } from './planet-shaders';

describe('planet shaders', () => {
  it('compile each kind as its own program, numbered as the shader numbers them', () => {
    expect(WORLD_KINDS.map((kind) => kindDefines(kind).KIND)).toEqual([0, 1, 2, 3]);
  });

  it('read the kind from the define, never from a uniform', () => {
    for (const shader of [SURFACE_FRAGMENT, CLOUD_FRAGMENT]) {
      expect(shader).toContain('const float kind = float(KIND);');
      expect(shader).not.toMatch(/uniform float[^;]*\bkind\b/);
    }
  });
});
