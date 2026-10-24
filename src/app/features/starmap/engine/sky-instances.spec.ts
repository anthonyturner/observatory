import { STAR_INSTANCED_VERTEX, STAR_TYPES } from '../../../shared/gl/star-shader';
import { Chart, SkyFrame } from './sky-frame';
import { BucketId, SkyStar } from './sky-model';
import { SkyInstances } from './sky-instances';
import { DISC_VERTEX, PLANET_VERTEX, PULSE_VERTEX } from './star-system-shaders';

interface StarOver {
  urgent?: boolean;
  custom?: boolean;
  cost?: number | null;
  mag?: number;
  bucket?: BucketId;
  issues?: number[];
}

const star = ({
  urgent = false,
  custom = false,
  cost = null,
  mag = 5,
  bucket = 'unreviewed',
  issues = [],
}: StarOver = {}): SkyStar =>
  ({
    kind: 'pr',
    urgent,
    custom,
    cost,
    mag,
    quick: false,
    ax: 10,
    ay: 20,
    az: 30,
    colour: '#ff0000',
    spin: 1,
    twinkle: 0,
    twinkleRate: 0,
    item: { pr: 1, title: '', bucket, idleDays: 2, additions: null, deletions: null, issues },
  }) as unknown as SkyStar;

interface FrameOver {
  chart?: Chart;
  frozen?: boolean;
  born?: number;
  dim?: number;
  scale?: number;
}

const frame = ({ chart = 'prs', frozen = false, born = 1, dim = 1, scale = 1 }: FrameOver = {}) =>
  ({
    t: 0,
    frozen,
    chart,
    camera: { current: { scale } },
    born: () => born,
    dim: () => dim,
  }) as unknown as SkyFrame;

const flat = () => 1;

describe('SkyInstances', () => {
  it('draws a body for each star but a custom one, and a mark only where a star has one', () => {
    const instances = new SkyInstances([
      star({ cost: 5000, urgent: true, issues: [1, 2] }),
      star({ custom: true }),
      star(),
    ]);

    expect(instances.bodies.count).toBe(2);
    expect(instances.discs.count).toBe(1);
    expect(instances.planets.count).toBe(2);
    expect(instances.pulses.count).toBe(1);
  });

  it('writes what never changes once: colour, type, activity and seed', () => {
    const instances = new SkyInstances([star({ bucket: 'failing' })]);

    expect(instances.bodies.arrays.aInk[0]).toBeCloseTo(1);
    const [type, activity, seed] = instances.bodies.arrays.aKind;
    expect(type).toBe(STAR_TYPES.indexOf('giant'));
    expect(activity).toBeGreaterThan(0);
    expect(seed).toBe(36);
  });

  it('places a star in the scene, sized by its magnitude and its depth', () => {
    const instances = new SkyInstances([star()]);

    instances.update(frame({ scale: 2 }), () => 0.5);

    expect(Array.from(instances.bodies.arrays.aPos)).toEqual([10, -20, 30]);
    // r = mag * scale = 10 and unit = 1 / (2 * 0.5) = 1; the quad spans twice its reach.
    expect(instances.bodies.arrays.aSize[0]).toBeCloseTo(10 * (128 / 14 / 2) * 2);
  });

  it('fades a star by the legend filter and by its arrival', () => {
    const instances = new SkyInstances([star()]);

    instances.update(frame({ dim: 0.2, born: 0.5 }), flat);
    const dimmed = instances.bodies.arrays.aState[2];
    instances.update(frame({ dim: 1, born: 1 }), flat);
    const full = instances.bodies.arrays.aState[2];

    expect(dimmed).toBeGreaterThan(0);
    expect(dimmed).toBeLessThan(full * 0.2);
  });

  it('shows surface detail only close up, widening the drawn disc with it', () => {
    const instances = new SkyInstances([star({ mag: 5 })]);

    instances.update(frame({ scale: 0.1 }), flat);
    const [farDetail, farDisc] = instances.bodies.arrays.aState;
    instances.update(frame({ scale: 4 }), flat);
    const [nearDetail, nearDisc] = instances.bodies.arrays.aState;

    expect(farDetail).toBe(0);
    expect(farDisc).toBeCloseTo(0.46);
    expect(nearDetail).toBe(1);
    expect(nearDisc).toBeCloseTo(0.75);
  });

  it('sizes a gas disc by its reach, and hides it off the Review Queue or before arrival', () => {
    const instances = new SkyInstances([star({ cost: 5000 })]);

    instances.update(frame(), flat);
    expect(instances.discs.arrays.aSize[0]).toBeGreaterThan(0);
    expect(instances.discs.arrays.aFade[1]).toBe(1);
    expect(Array.from(instances.discs.arrays.aPos)).toEqual([10, -20, 30]);

    instances.update(frame({ chart: 'logs' }), flat);
    expect(instances.discs.arrays.aSize[0]).toBe(0);
    expect(instances.discs.arrays.aFade[1]).toBe(0);

    instances.update(frame({ born: 0 }), flat);
    expect(instances.discs.arrays.aSize[0]).toBe(0);
  });

  it('keeps each planet near its star, shown once the star has detail', () => {
    const instances = new SkyInstances([star({ mag: 5, issues: [3, 5] })]);

    instances.update(frame({ scale: 0.1 }), flat);
    expect(Array.from(instances.planets.arrays.aSize)).toEqual([0, 0]);
    expect(Array.from(instances.planets.arrays.aOpacity)).toEqual([0, 0]);

    instances.update(frame({ scale: 4 }), flat);
    const { aSize, aOpacity, aStar, aPos } = instances.planets.arrays;
    expect(aSize[0]).toBeGreaterThan(0);
    expect(aOpacity[0]).toBe(1);
    expect(Array.from(aStar.slice(0, 3))).toEqual([10, -20, 30]);
    expect(Math.hypot(aPos[0] - 10, aPos[1] + 20)).toBeGreaterThan(0);
    expect(aPos[3]).not.toBe(aPos[0]);
  });

  it('pulses an urgent star as a ring that grows and fades, and rests when motion is off', () => {
    const instances = new SkyInstances([star({ urgent: true })]);

    instances.update(frame(), flat);
    expect(instances.pulses.arrays.aSize[0]).toBeGreaterThan(0);
    expect(instances.pulses.arrays.aAlpha[0]).toBeGreaterThan(0);
    expect(instances.pulses.arrays.aAlpha[0]).toBeCloseTo(0.34, 1);

    instances.update(frame({ frozen: true }), flat);
    expect(instances.pulses.arrays.aSize[0]).toBe(0);
    expect(instances.pulses.arrays.aAlpha[0]).toBe(0);
  });
});

describe('SkyInstances.load', () => {
  it('lays the same batches out for new stars, rewriting what never changes', () => {
    const instances = new SkyInstances([star({ cost: 5000, urgent: true, issues: [1, 2] })]);
    const { bodies, discs, planets, pulses } = instances;

    instances.load([star({ bucket: 'failing' }), star(), star()]);

    expect([instances.bodies, instances.discs, instances.planets, instances.pulses]).toEqual([
      bodies,
      discs,
      planets,
      pulses,
    ]);
    expect([bodies.count, discs.count, planets.count, pulses.count]).toEqual([3, 0, 0, 0]);
    expect(bodies.arrays.aKind[0]).toBe(STAR_TYPES.indexOf('giant'));
  });

  it('places the new stars, not the old', () => {
    const instances = new SkyInstances([star()]);
    const next = star();
    Object.assign(next, { ax: 7, ay: 8, az: 9 });

    instances.load([next]);
    instances.update(frame(), flat);

    expect(Array.from(instances.bodies.arrays.aPos.slice(0, 3))).toEqual([7, -8, 9]);
  });
});

describe('the attributes the shaders read', () => {
  const declared = (shader: string): string[] =>
    [...shader.matchAll(/attribute \w+ ([^;]+);/g)].flatMap((m) =>
      m[1].split(',').map((name) => name.trim()),
    );
  const instances = new SkyInstances([star({ cost: 5000, urgent: true, issues: [1] })]);

  it.each([
    ['stars', STAR_INSTANCED_VERTEX, instances.bodies],
    ['discs', DISC_VERTEX, instances.discs],
    ['planets', PLANET_VERTEX, instances.planets],
    ['pulses', PULSE_VERTEX, instances.pulses],
  ])('are exactly what the %s batch holds', (_kind, shader, batch) => {
    expect(declared(shader).sort()).toEqual(Object.keys(batch.arrays).sort());
  });
});
