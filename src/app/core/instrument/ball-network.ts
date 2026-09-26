import { seededRandom } from './seeded-random';

/** The ball in its own unit space, so one set of points serves every size of
 *  core, and the lines joining each point to its nearest neighbours. */
export interface BallNetwork {
  readonly count: number;
  /** xyz per point, inside the unit sphere. */
  readonly points: Float32Array;
  /** 0 to 1 per point: where in its twinkle it starts. */
  readonly phases: Float32Array;
  /** 0 to 1 per point: how large and bright it draws. */
  readonly weights: Float32Array;
  /** a, b, strength per line; a short line is a strong one. */
  readonly links: Float32Array;
}

const MAX_POINTS = 2800;
const MIN_POINTS = 500;
/** The 2D core turns and projects every point itself each frame, so it takes
 *  half the 3D count, and never more than this. */
const MAX_POINTS_2D = 480;
const POINTS_PER_SQUARE_PIXEL = 0.095;
const BALL_SEED = 1729;
const LINKS_PER_POINT = 2;
/** Cell keys pack three signed cell indices into one number; cells stay well inside ±64. */
const CELL_OFFSET = 64;
const CELL_SPAN = 128;

/** How many points a core of this radius takes: it follows the core's area. */
export function ballCount3D(radius: number): number {
  return Math.round(
    Math.min(MAX_POINTS, Math.max(MIN_POINTS, radius * radius * POINTS_PER_SQUARE_PIXEL)),
  );
}

export function ballCount2D(radius: number): number {
  return Math.min(MAX_POINTS_2D, Math.round(ballCount3D(radius) / 2));
}

interface UnitBall {
  readonly points: Float32Array;
  readonly phases: Float32Array;
  readonly weights: Float32Array;
}

let unitBall: UnitBall | null = null;
const networks = new Map<number, BallNetwork>();

/** Density falls off as one over the radius, which makes the centre read dense and bright. */
function buildUnitBall(): UnitBall {
  const random = seededRandom(BALL_SEED);
  const points = new Float32Array(MAX_POINTS * 3);
  const phases = new Float32Array(MAX_POINTS);
  const weights = new Float32Array(MAX_POINTS);
  for (let i = 0; i < MAX_POINTS; i++) {
    const z = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const ring = Math.sqrt(1 - z * z);
    const depth = Math.sqrt(random());
    points[i * 3] = ring * Math.cos(angle) * depth;
    points[i * 3 + 1] = z * depth;
    points[i * 3 + 2] = ring * Math.sin(angle) * depth;
    phases[i] = random();
    weights[i] = Math.pow(random(), 1.8);
  }
  return { points, phases, weights };
}

/** The first `count` points and their lines. Cached per count; a desktop's
 *  count takes tens of milliseconds, once. */
export function ballNetwork(count: number): BallNetwork {
  const clamped = Math.max(0, Math.min(MAX_POINTS, Math.round(count)));
  const cached = networks.get(clamped);
  if (cached) return cached;
  unitBall ??= buildUnitBall();
  const network: BallNetwork = {
    count: clamped,
    points: unitBall.points.subarray(0, clamped * 3),
    phases: unitBall.phases.subarray(0, clamped),
    weights: unitBall.weights.subarray(0, clamped),
    links: linkNearest(unitBall.points, clamped),
  };
  networks.set(clamped, network);
  return network;
}

/** Joins each point to its nearest neighbours within reach, searching a grid
 *  of cells one reach wide so the search stays near linear. */
function linkNearest(points: Float32Array, count: number): Float32Array {
  const reach = 2.2 * Math.pow(Math.max(count, 1), -1 / 3);
  const cells = bucketByCell(points, count, reach);
  const seen = new Set<number>();
  const links: number[] = [];
  for (let i = 0; i < count; i++) {
    for (const { distanceSquared, index } of nearestTo(i, points, cells, reach)) {
      const pair = i < index ? i * MAX_POINTS + index : index * MAX_POINTS + i;
      if (seen.has(pair)) continue;
      seen.add(pair);
      links.push(i, index, 1 - Math.sqrt(distanceSquared) / reach);
    }
  }
  return Float32Array.from(links);
}

const cellOf = (value: number, reach: number): number => Math.floor(value / reach);
const cellKey = (x: number, y: number, z: number): number =>
  ((x + CELL_OFFSET) * CELL_SPAN + (y + CELL_OFFSET)) * CELL_SPAN + (z + CELL_OFFSET);

function bucketByCell(points: Float32Array, count: number, reach: number): Map<number, number[]> {
  const cells = new Map<number, number[]>();
  for (let i = 0; i < count; i++) {
    const key = cellKey(
      cellOf(points[i * 3], reach),
      cellOf(points[i * 3 + 1], reach),
      cellOf(points[i * 3 + 2], reach),
    );
    const bucket = cells.get(key) ?? [];
    bucket.push(i);
    cells.set(key, bucket);
  }
  return cells;
}

interface Neighbour {
  readonly distanceSquared: number;
  readonly index: number;
}

function nearestTo(
  i: number,
  points: Float32Array,
  cells: Map<number, number[]>,
  reach: number,
): Neighbour[] {
  const [cx, cy, cz] = [0, 1, 2].map((axis) => cellOf(points[i * 3 + axis], reach));
  const near: Neighbour[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (const j of cells.get(cellKey(cx + dx, cy + dy, cz + dz)) ?? []) {
          const distanceSquared = squaredDistance(points, i, j);
          if (j !== i && distanceSquared < reach * reach) near.push({ distanceSquared, index: j });
        }
      }
    }
  }
  return near.sort((a, b) => a.distanceSquared - b.distanceSquared).slice(0, LINKS_PER_POINT);
}

function squaredDistance(points: Float32Array, i: number, j: number): number {
  const ex = points[i * 3] - points[j * 3];
  const ey = points[i * 3 + 1] - points[j * 3 + 1];
  const ez = points[i * 3 + 2] - points[j * 3 + 2];
  return ex * ex + ey * ey + ez * ez;
}
