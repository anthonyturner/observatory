import { rnd } from './rnd';
import {
  BUCKETS,
  FieldStar,
  SkyCluster,
  SkyItem,
  SkyStar,
  StarFields,
  WORLD,
  costOf,
  isQuick,
} from './sky-model';

/** A sky being laid out: its constellations and stars, in drawing order. */
export class SkyLayout {
  readonly clusters: SkyCluster[] = [];
  readonly stars: SkyStar[] = [];

  /** The motion every star shares, whichever sky it belongs to. */
  makeStar(fields: StarFields, r: () => number, driftRadius: number): SkyStar {
    const star: SkyStar = {
      ...fields,
      twinkle: r() * Math.PI * 2,
      twinkleRate: 0.55 + r() * 1.5,
      driftA: r() * Math.PI * 2,
      driftB: r() * Math.PI * 2,
      driftRate1: 0.26 + r() * 0.3,
      driftRate2: 0.21 + r() * 0.26,
      driftRadius,
      spin: r() * Math.PI,
      // Stars light up in sequence, in queue order, so the first frame reads
      // as the queue assembling rather than as a picture appearing.
      delay: 0.1 + Math.min(this.stars.length * 0.035, 3),
      z: 0,
      ax: fields.x,
      ay: fields.y,
      az: 0,
    };
    // The depth draws on the generator after the motion, as pr-starmap's does,
    // so the same seed places every star exactly where pr-starmap put it.
    star.z = (fields.cluster.z ?? 0) + (r() - 0.5) * 150;
    star.az = star.z;
    fields.cluster.stars.push(star);
    this.stars.push(star);
    return star;
  }
}

/** Each bucket in use a constellation, left to right, alternately above and below. */
export function layoutQueue(items: readonly SkyItem[], sky: SkyLayout): void {
  const used = BUCKETS.filter((b) => items.some((i) => i.bucket === b.id));
  const slot = WORLD.w / (used.length + 1);

  used.forEach((bucket, ci) => {
    const mine = items.filter((i) => i.bucket === bucket.id);
    const cx = slot * (ci + 1);
    const cy = WORLD.h / 2 + (ci % 2 === 0 ? -1 : 1) * (170 + ((ci * 37) % 120));
    const cluster: SkyCluster = {
      cx,
      cy,
      z: (ci - 2.5) * 95,
      labelY: cy,
      colour: bucket.colour,
      label: bucket.label,
      sub: `${bucket.sub.toUpperCase()} · ${mine.length}`,
      stars: [],
    };
    const n = mine.length;
    const spread = Math.min(300 + n * 42, 620);

    mine.forEach((item, i) => {
      const r = rnd((item.pr * 2654435761) % 2147483647);
      const t = n === 1 ? 0.5 : i / (n - 1);
      const angle = (-0.85 + t * 1.7) * Math.PI * 0.42;
      const radius = spread * (0.45 + 0.55 * t);
      sky.makeStar(
        {
          kind: 'pr',
          item,
          key: item.bucket,
          urgent: item.bucket === 'conflicted' || item.bucket === 'failing',
          cost: costOf(item),
          quick: isQuick(item),
          tag: `#${item.pr}`,
          caption: item.title,
          x: cx + Math.sin(angle) * radius + (r() - 0.5) * 70,
          y: cy - Math.cos(angle) * radius * 0.52 + (r() - 0.5) * 70,
          // Magnitude follows neglect: the longer it has sat, the bigger it burns.
          mag: 4 + Math.min(Math.sqrt(Math.max(item.idleDays, 0)) * 2.6, 13),
          colour: bucket.colour,
          cluster,
        },
        r,
        9 + Math.min(item.idleDays * 0.42, 26),
      );
    });

    sky.clusters.push(cluster);
  });
}

/** Real starfields are not white: a spread of colour temperature. */
const FIELD_TINTS = ['#ffffff', '#dce8ff', '#bcd2ff', '#fff0d6', '#ffd9b8'];

export function buildField(): FieldStar[] {
  const fr = rnd(90210);
  const make = (n: number, depth: number, maxR: number, maxA: number): FieldStar[] =>
    Array.from({ length: n }, () => ({
      x: fr() * WORLD.w * 1.8 - WORLD.w * 0.4,
      y: fr() * WORLD.h * 1.8 - WORLD.h * 0.4,
      r: fr() * maxR + 0.2,
      a: fr() * maxA + 0.05,
      depth,
      phase: fr() * Math.PI * 2,
      rate: 0.3 + fr() * 1.9,
      tint: FIELD_TINTS[Math.floor(fr() * FIELD_TINTS.length)],
      z: 0,
    }));
  const field = [...make(520, 0.3, 0.9, 0.34), ...make(220, 0.62, 1.4, 0.5)];
  for (const s of field) s.z = -1800 - fr() * 9000;
  return field;
}

/** A key that survives a relayout, for stars that stand for something. */
const keyOf = (s: SkyStar): string | null => {
  if (s.item) return `pr${s.item.pr}`;
  const data = s.data as { number?: number } | undefined;
  return s.kind === 'issue' && data?.number != null ? `issue${data.number}` : null;
};

/**
 * Keeps the sky continuous across a change: a star already on screen glides
 * from where it was instead of being born again, and only newcomers arrive.
 */
export function carryOver(
  previous: readonly SkyStar[],
  next: readonly SkyStar[],
  bornAt: number,
): void {
  const was = new Map(
    previous.filter((s) => keyOf(s)).map((s) => [keyOf(s) as string, s] as const),
  );
  let fresh = 0;
  for (const s of next) {
    const key = keyOf(s);
    const old = key ? was.get(key) : undefined;
    if (old) {
      s.fromX = old.ax;
      s.fromY = old.ay;
      s.fromZ = old.az;
      s.ax = old.ax;
      s.ay = old.ay;
      s.az = old.az;
      s.moveAt = bornAt;
      s.delay = -10;
    } else {
      s.delay = 0.2 + fresh++ * 0.08;
    }
  }
}
