import { fallOf, keepApart, placeByHole, redshift } from './black-hole';
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
    // so the same seed gives every star the depth pr-starmap gave it.
    star.z = (fields.cluster.z ?? 0) + (r() - 0.5) * 150;
    star.az = star.z;
    fields.cluster.stars.push(star);
    this.stars.push(star);
    return star;
  }
}

/* A constellation is a spiral arm: the first PR in queue order at its heart,
   the rest winding outward a fixed step apart, so a big group grows wider
   instead of packing tighter. */
/** Distance between neighbouring stars along the arm. */
const ARM_STEP = 130;
/** Distance between one turn of the arm and the next. */
const TURN_GAP = 165;
const ARM_START = 30;
/** A little disorder, well inside the gaps, so the arm does not look ruled. */
const JITTER = 18;
/** Clear sky between neighbouring constellations. */
const CLUSTER_GAP = 240;
/** A lone star still needs room for its label. */
const MIN_HALF_WIDTH = 140;
/** The constellation's name sits under its arm, not on its heart. */
const LABEL_GAP = 90;

/** Offsets from the constellation's centre for `n` stars along one arm. */
export function spiralArm(n: number, turn: number): { dx: number; dy: number }[] {
  const b = TURN_GAP / (Math.PI * 2);
  let theta = 0;
  return Array.from({ length: n }, () => {
    const radius = ARM_START + b * theta;
    const at = { dx: Math.cos(theta + turn) * radius, dy: Math.sin(theta + turn) * radius };
    theta += ARM_STEP / Math.hypot(radius, b);
    return at;
  });
}

/** Moves each laid-out star where the black hole's pull puts it, then off any star it landed on. */
function settleByHole(pulls: ReadonlyMap<SkyStar, number>): void {
  for (const [star, pull] of pulls) {
    const at = placeByHole(star, pull);
    star.x = at.x;
    star.y = at.y;
    star.z = at.z;
  }
  const stars = [...pulls.keys()];
  keepApart(stars, (star) => pulls.get(star) ?? 0);
  for (const star of stars) {
    star.ax = star.x;
    star.ay = star.y;
    star.az = star.z;
  }
}

/**
 * Each bucket in use a constellation, left to right, alternately above and
 * below; a pull request idle past `staleAfterDays` is drawn toward the black
 * hole at the centre. With no threshold nothing falls.
 */
export function layoutQueue(
  items: readonly SkyItem[],
  sky: SkyLayout,
  staleAfterDays = Number.POSITIVE_INFINITY,
): void {
  const groups = BUCKETS.map((bucket, bi) => {
    const mine = items.filter((i) => i.bucket === bucket.id);
    const arm = spiralArm(mine.length, bi * 1.9);
    const half = Math.max(MIN_HALF_WIDTH, ...arm.map((p) => Math.abs(p.dx) + JITTER));
    const below = Math.max(...arm.map((p) => p.dy)) + JITTER;
    return { bucket, mine, arm, half, below };
  }).filter((g) => g.mine.length);
  const span = groups.reduce((sum, g) => sum + g.half * 2, 0) + CLUSTER_GAP * (groups.length - 1);
  let left = WORLD.w / 2 - span / 2;
  const pulls = new Map<SkyStar, number>();

  groups.forEach(({ bucket, mine, arm, half, below }, ci) => {
    const cx = left + half;
    left += half * 2 + CLUSTER_GAP;
    const cy = WORLD.h / 2 + (ci % 2 === 0 ? -1 : 1) * (140 + ((ci * 37) % 100));
    const cluster: SkyCluster = {
      cx,
      cy,
      z: (ci - 2.5) * 95,
      labelY: cy + below + LABEL_GAP,
      colour: bucket.colour,
      label: bucket.label,
      sub: `${bucket.sub.toUpperCase()} · ${mine.length}`,
      stars: [],
    };

    mine.forEach((item, i) => {
      const r = rnd((item.pr * 2654435761) % 2147483647);
      const pull = fallOf(item.idleDays, staleAfterDays);
      const star = sky.makeStar(
        {
          kind: 'pr',
          item,
          key: item.bucket,
          urgent: item.bucket === 'conflicted' || item.bucket === 'failing',
          cost: costOf(item),
          quick: isQuick(item),
          tag: `#${item.pr}`,
          caption: item.title,
          x: cx + arm[i].dx + (r() - 0.5) * 2 * JITTER,
          y: cy + arm[i].dy + (r() - 0.5) * 2 * JITTER,
          // Magnitude follows neglect: the longer it has sat, the bigger it burns.
          mag: 3.5 + Math.min(Math.sqrt(Math.max(item.idleDays, 0)) * 2.2, 9.5),
          colour: redshift(bucket.colour, pull),
          cluster,
        },
        r,
        // Drift stays well inside the gaps, so neighbours never wander together.
        5 + Math.min(item.idleDays * 0.2, 11),
      );
      pulls.set(star, pull);
    });

    sky.clusters.push(cluster);
  });
  settleByHole(pulls);
}

/** Real starfields are not white: a spread of colour temperature. */
const FIELD_TINTS = ['#ffffff', '#dce8ff', '#bcd2ff', '#fff0d6', '#ffd9b8'];

const glow = (magnitude: number, glint: number, maxR: number, maxA: number) => ({
  r: magnitude * maxR + 0.2,
  a: 0.05 + maxA * (0.75 * magnitude + 0.25 * glint * glint),
});

export function buildField(): FieldStar[] {
  const fr = rnd(90210);
  const make = (n: number, depth: number, maxR: number, maxA: number): FieldStar[] =>
    Array.from({ length: n }, () => ({
      x: fr() * WORLD.w * 1.8 - WORLD.w * 0.4,
      y: fr() * WORLD.h * 1.8 - WORLD.h * 0.4,
      // Mostly faint stars and a few bright ones: brightness falls off as a
      // power of an even draw, the largest also the brightest.
      ...glow(Math.pow(fr(), 3), fr(), maxR, maxA),
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
