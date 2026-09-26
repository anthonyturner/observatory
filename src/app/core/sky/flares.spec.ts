import { seededRandom } from '../instrument/seeded-random';
import { FLARE_S, MAX_FLARES, flareAt, flaresFrom } from './flares';

const TARGET = { width: 1280, poleX: 640, poleY: 360 };

describe('flaresFrom', () => {
  it('sends one per thing done, one after another, up to the cap', () => {
    const flares = flaresFrom(3, 10, seededRandom(1));
    expect(flares).toHaveLength(3);
    expect(flares[1].startS).toBeGreaterThan(flares[0].startS);
    expect(flaresFrom(50, 0, seededRandom(1))).toHaveLength(MAX_FLARES);
    expect(flaresFrom(0, 0, seededRandom(1))).toEqual([]);
  });
});

describe('flareAt', () => {
  const [flare] = flaresFrom(1, 10, seededRandom(2));

  it('is out of the sky before it sets off and after it arrives', () => {
    expect(flareAt(flare, 9, TARGET)).toBeNull();
    expect(flareAt(flare, 10 + FLARE_S + 0.1, TARGET)).toBeNull();
  });

  it('heads for the core, reaching it as it ends', () => {
    const early = flareAt(flare, 10.2, TARGET);
    const late = flareAt(flare, 10 + FLARE_S, TARGET);
    expect(early && late).toBeTruthy();
    expect(Math.hypot(late!.headX - 640, late!.headY - 360)).toBeLessThan(1);
    expect(late!.alpha).toBeCloseTo(0);
    expect(early!.headY).toBeLessThan(late!.headY);
  });
});
