import { continuedSeed, seededRandom } from '../instrument/seeded-random';
import { formatCount, windowName } from './log-format';
import { DAY_MS, LogKey, LogPalette, RECENT_DAYS } from './log-levels';
import { LogFault, LogSnapshot, LogWindow } from './log-snapshot';

/** One star of the log sky, before the engine gives it motion: pr-starmap's
 *  fields, so `makeStar(star, rnd(star.seed), star.driftRadius)` places it. */
export interface LogStar {
  readonly kind: 'fault' | 'quiet';
  /** The error or warning, on a fault star. */
  readonly fault?: LogFault;
  /** The window, on a quiet star. */
  readonly win?: LogWindow;
  readonly key: LogKey;
  /** Still burning: it fired within three days of the newest line. */
  readonly urgent: boolean;
  /** `×1,204` under the star; empty on a quiet one. */
  readonly tag: string;
  readonly caption: string;
  /** Its resting place, in world units. */
  readonly x: number;
  readonly y: number;
  readonly mag: number;
  readonly colour: string;
  readonly driftRadius: number;
  /** Carries on its window's random sequence where the star's own draws begin,
   *  so the motion drawn from `seededRandom(seed)` is pr-starmap's exactly. */
  readonly seed: number;
}

/** One window as a constellation. */
export interface LogCluster {
  readonly cx: number;
  readonly cy: number;
  readonly z: number;
  /** Where its name sits: under its outermost star. */
  readonly labelY: number;
  readonly colour: string;
  readonly label: string;
  /** `71,365 LINES · 1 ERR · 209 WARN`. */
  readonly sub: string;
  readonly win: LogWindow;
  readonly stars: readonly LogStar[];
}

export interface LogSkyLayout {
  readonly clusters: readonly LogCluster[];
  /** Every star, in the order the clusters hold them. */
  readonly stars: readonly LogStar[];
}

/** The plane the sky is laid on, the pull-request sky's own. */
export const LOG_WORLD = { width: 3600, height: 2000 } as const;
const RING_RADIUS_X = 1500;
const RING_RADIUS_Y = 820;
const LAYER_DEPTH = 95;
const LAYERS = 5;
const MIDDLE_LAYER = 2;
const WINDOW_SEED = 104729;
/** The golden angle, in radians: each fault turns this far from the last. */
const GOLDEN_ANGLE = 2.39996;
const SPIRAL_STEP = 30;
const SPIRAL_START = 26;
const SPIRAL_WIDTH = 1.25;
const SPIRAL_HEIGHT = 0.85;
const JITTER = 14;
const LABEL_GAP = 58;
/** A size that grows with how often something happened, on a log scale. */
interface Growth {
  readonly base: number;
  readonly perDoubling: number;
  readonly most: number;
}
// Magnitude follows volume, on a log scale: a fault that fired five hundred
// times should dominate, not blot out everything near it.
const FAULT_MAGNITUDE: Growth = { base: 3.5, perDoubling: 1.9, most: 13 };
const FAULT_DRIFT: Growth = { base: 7, perDoubling: 1.6, most: 16 };
const QUIET_MAGNITUDE: Growth = { base: 4, perDoubling: 0.6, most: 8 };
const QUIET_DRIFT = 10;
/** What pr-starmap's makeStar draws for each star: twinkle, its rate, two
 *  drift phases, two drift rates, spin, and depth. */
const DRAWS_PER_STAR = 8;

/** A window's colour is its worst level. */
export const windowKey = (window: LogWindow): LogKey =>
  window.error ? 'error' : window.warn ? 'warn' : 'quiet';

/** Whether a fault fired within `RECENT_DAYS` of the newest line in the folder. */
export function burning(snapshot: LogSnapshot, fault: LogFault): boolean {
  if (!snapshot.span.to) return false;
  return Date.parse(snapshot.span.to) - Date.parse(fault.lastAt) < RECENT_DAYS * DAY_MS;
}

/** A random stream that knows how many draws it has given. */
function countedRandom(seed: number): {
  readonly next: () => number;
  readonly seedHere: () => number;
} {
  const random = seededRandom(seed);
  let draws = 0;
  return {
    next: () => {
      draws++;
      return random();
    },
    seedHere: () => continuedSeed(seed, draws),
  };
}

/**
 * The worst window sits at the centre (for an Overwolf app, usually the
 * desktop window every HUD window is opened from) and the rest ring it, worst
 * first from twelve o'clock. Inside each
 * constellation the stars wind out on a golden-angle spiral, so the loudest
 * fault is the core and the one-offs trail at the rim.
 */
export function layoutLogs(snapshot: LogSnapshot | null, palette: LogPalette): LogSkyLayout {
  if (!snapshot) return { clusters: [], stars: [] };
  const byWindow = new Map<string, LogFault[]>();
  for (const fault of snapshot.faults) {
    const mine = byWindow.get(fault.window) ?? [];
    mine.push(fault);
    byWindow.set(fault.window, mine);
  }
  // A window whose faults all fell past the chart's cap has nothing true to
  // draw as a single quiet star, so it is left to the totals.
  const shown = snapshot.windows.filter(
    (window) => byWindow.has(window.id) || (!window.error && !window.warn),
  );
  const ring = Math.max(shown.length - 1, 1);
  const clusters = shown.map((window, index) =>
    layoutWindow({ snapshot, palette, window, index, ring, faults: byWindow.get(window.id) ?? [] }),
  );
  return { clusters, stars: clusters.flatMap((cluster) => cluster.stars) };
}

interface WindowPlace {
  readonly snapshot: LogSnapshot;
  readonly palette: LogPalette;
  readonly window: LogWindow;
  readonly index: number;
  readonly ring: number;
  readonly faults: readonly LogFault[];
}

function layoutWindow(place: WindowPlace): LogCluster {
  const { window, index, palette } = place;
  const angle = -Math.PI / 2 + ((index - 1) / place.ring) * Math.PI * 2;
  const cx = LOG_WORLD.width / 2 + (index === 0 ? 0 : Math.cos(angle) * RING_RADIUS_X);
  const cy = LOG_WORLD.height / 2 + (index === 0 ? 0 : Math.sin(angle) * RING_RADIUS_Y);
  const random = countedRandom((index + 1) * WINDOW_SEED);
  const stars = place.faults.length
    ? place.faults.map((fault, order) => faultStar(place, fault, order, { cx, cy, random }))
    : [quietStar(window, palette, { cx, cy, random })];
  const reach = Math.max(0, ...place.faults.map((_, order) => spiralRadius(order)));
  return {
    cx,
    cy,
    z: ((index % LAYERS) - MIDDLE_LAYER) * LAYER_DEPTH,
    labelY: cy + reach * SPIRAL_HEIGHT + LABEL_GAP,
    colour: palette[windowKey(window)],
    label: windowName(window.id),
    sub: `${formatCount(window.lines)} LINES · ${formatCount(window.error)} ERR · ${formatCount(window.warn)} WARN`,
    win: window,
    stars,
  };
}

interface Centre {
  readonly cx: number;
  readonly cy: number;
  readonly random: ReturnType<typeof countedRandom>;
}

const spiralRadius = (order: number): number =>
  order === 0 ? 0 : SPIRAL_STEP * Math.sqrt(order) + SPIRAL_START;
const grown = (growth: Growth, count: number): number =>
  growth.base + Math.min(Math.log2(count + 1) * growth.perDoubling, growth.most);

function faultStar(place: WindowPlace, fault: LogFault, order: number, centre: Centre): LogStar {
  const { cx, cy, random } = centre;
  const radius = spiralRadius(order);
  const turn = order * GOLDEN_ANGLE + place.index;
  const x = cx + Math.cos(turn) * radius * SPIRAL_WIDTH + (random.next() - 0.5) * JITTER;
  const y = cy + Math.sin(turn) * radius * SPIRAL_HEIGHT + (random.next() - 0.5) * JITTER;
  const seed = random.seedHere();
  for (let draw = 0; draw < DRAWS_PER_STAR; draw++) random.next();
  return {
    kind: 'fault',
    fault,
    key: fault.level,
    urgent: burning(place.snapshot, fault),
    tag: `×${formatCount(fault.count)}`,
    caption: fault.text,
    x,
    y,
    mag: grown(FAULT_MAGNITUDE, fault.count),
    colour: place.palette[fault.level],
    driftRadius: grown(FAULT_DRIFT, fault.count),
    seed,
  };
}

function quietStar(window: LogWindow, palette: LogPalette, centre: Centre): LogStar {
  const seed = centre.random.seedHere();
  for (let draw = 0; draw < DRAWS_PER_STAR; draw++) centre.random.next();
  return {
    kind: 'quiet',
    win: window,
    key: 'quiet',
    urgent: false,
    tag: '',
    caption: '',
    x: centre.cx,
    y: centre.cy,
    mag: grown(QUIET_MAGNITUDE, window.lines),
    colour: palette.quiet,
    driftRadius: QUIET_DRIFT,
    seed,
  };
}
