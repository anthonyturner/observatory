/* The star map's model, as pr-starmap keeps it: buckets with their colours, and
   the stars and constellations every renderer draws. Colours are canvas inks,
   pr-starmap's own, so the sky matches it exactly. */

export type BucketId = 'conflicted' | 'failing' | 'unknown' | 'unlinked' | 'unreviewed' | 'fresh';

export interface Bucket {
  readonly id: BucketId;
  readonly label: string;
  readonly sub: string;
  readonly colour: string;
  readonly why: string;
}

export const BUCKETS: readonly Bucket[] = [
  {
    id: 'conflicted',
    label: 'Aporia',
    sub: 'Cannot merge',
    colour: '#ff6f5e',
    why: 'every merge into main widens the gap',
  },
  {
    id: 'failing',
    label: 'Ruina',
    sub: 'Checks failing',
    colour: '#ff9a3d',
    why: 'a check reported failure, error or timeout',
  },
  {
    id: 'unknown',
    label: 'Nebulosa',
    sub: 'Mergeability unknown',
    colour: '#c08cff',
    why: 'GitHub has not settled whether this still merges',
  },
  {
    id: 'unlinked',
    label: 'Vagrans',
    sub: 'No issue linked',
    colour: '#ffc24d',
    why: 'merging closes no issue',
  },
  {
    id: 'unreviewed',
    label: 'Vigilia',
    sub: 'Waiting on you',
    colour: '#6fd4ff',
    why: 'never triaged — oldest first',
  },
  {
    id: 'fresh',
    label: 'Quies',
    sub: 'Seen recently',
    colour: '#5fe3a1',
    why: 'context, not a demand',
  },
];

export const BY_ID: ReadonlyMap<BucketId, Bucket> = new Map(BUCKETS.map((b) => [b.id, b]));

/** A pull request the sky charts, in pr-starmap's shape. */
export interface SkyItem {
  readonly pr: number;
  readonly title: string;
  readonly bucket: BucketId;
  readonly idleDays: number;
  readonly additions: number | null;
  readonly deletions: number | null;
  /** Issues it says it closes. */
  readonly issues: readonly number[];
}

/* Review cost: a quick win is ready and small enough to merge in minutes. */
export const QUICK_LINES = 200;
export const QUICK_COLOUR = '#9ef0c0';
export const costOf = (i: SkyItem): number | null =>
  i.additions == null ? null : i.additions + (i.deletions ?? 0);
/** Drafts count: agents open everything as a draft. */
export const isQuick = (i: SkyItem): boolean => {
  const cost = costOf(i);
  return (i.bucket === 'unreviewed' || i.bucket === 'fresh') && cost != null && cost <= QUICK_LINES;
};

/** A constellation: one bucket, or one log window. */
export interface SkyCluster {
  readonly cx: number;
  readonly cy: number;
  readonly z: number;
  labelY: number;
  readonly colour: string;
  readonly label: string;
  readonly sub: string;
  readonly stars: SkyStar[];
  /** A cluster drawn as a spiral arm, with no constellation line. */
  readonly arm?: boolean;
  /** A cluster whose label the renderer leaves to someone else. */
  readonly halo?: boolean;
}

export type StarKind = 'pr' | 'fault' | 'quiet' | 'issue' | 'comet';

/** The fields a layout decides; `makeStar` adds the motion every star shares. */
export interface StarFields {
  readonly kind: StarKind;
  readonly key: string;
  readonly urgent: boolean;
  readonly tag: string;
  readonly caption: string;
  readonly x: number;
  readonly y: number;
  readonly mag: number;
  readonly colour: string;
  readonly cluster: SkyCluster;
  readonly item?: SkyItem;
  readonly cost?: number | null;
  readonly quick?: boolean;
  /** Anything a layout carries for its own sky: a log fault, a window, an issue. */
  readonly data?: unknown;
}

export interface SkyStar extends StarFields {
  readonly twinkle: number;
  readonly twinkleRate: number;
  readonly driftA: number;
  readonly driftB: number;
  readonly driftRate1: number;
  readonly driftRate2: number;
  readonly driftRadius: number;
  readonly spin: number;
  delay: number;
  z: number;
  /** Where it is drawn this frame. */
  ax: number;
  ay: number;
  az: number;
  /** A carried star glides from here. */
  fromX?: number;
  fromY?: number;
  fromZ?: number;
  moveAt?: number | null;
  /** Drawn by its own sky's code, not as a star. */
  readonly custom?: boolean;
}

/** One background star. */
export interface FieldStar {
  readonly x: number;
  readonly y: number;
  z: number;
  readonly r: number;
  readonly a: number;
  readonly depth: number;
  readonly phase: number;
  readonly rate: number;
  readonly tint: string;
}

/** The world the layouts place stars in. */
export const WORLD = { w: 3600, h: 2000 } as const;
export const DAY_MS = 86_400_000;
