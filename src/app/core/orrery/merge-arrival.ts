/* How the Orrery takes in a merged pull request: one city light dims on the
   project's world, and a speck flies from the world into the shipped Milky Way.
   The timings live here so the picture and the score keep to one clock. */

/** Seconds from the world's launch to the speck settling in the band. */
export const FLIGHT_S = 2.6;
/** The light goes down over this many seconds, stays out, then comes back. */
const DIM_DOWN_S = 0.5;
const DIM_HOLD_S = 3;
const DIM_UP_S = 4;
/** Seconds the speck's landing ring spreads. */
export const LANDING_S = 0.7;
/** The speck sets off a beat after the light goes, so the eye sees the cause first. */
export const LAUNCH_LAG_S = 0.35;

const clamp = (value: number): number => Math.min(Math.max(value, 0), 1);

/** Projects whose open pull request count fell between two readings, in the
 *  order of `after`. A project not seen before cannot have dropped. */
export function openDrops(
  before: ReadonlyMap<string, number>,
  after: readonly { readonly repo: string; readonly open: number }[],
): string[] {
  return after
    .filter(({ repo, open }) => open < (before.get(repo) ?? -Infinity))
    .map(({ repo }) => repo);
}

/** How far along its flight the speck is, 0 to 1, `elapsed` seconds after launch: it
 *  leaves the world gently, quickens, and settles into the band. */
export function flightAt(elapsed: number): number {
  const t = clamp(elapsed / FLIGHT_S);
  return t * t * (3 - 2 * t);
}

/** How far down the light is, 0 (as lit) to 1 (out), `elapsed` seconds after the merge. */
export function dimAt(elapsed: number): number {
  if (elapsed <= 0) return 0;
  if (elapsed < DIM_DOWN_S) return clamp(elapsed / DIM_DOWN_S);
  if (elapsed < DIM_DOWN_S + DIM_HOLD_S) return 1;
  return 1 - clamp((elapsed - DIM_DOWN_S - DIM_HOLD_S) / DIM_UP_S);
}

/** Past this the light is back and the effect can be forgotten. */
export const DIM_TOTAL_S = DIM_DOWN_S + DIM_HOLD_S + DIM_UP_S;

/** How far from straight-away-from-the-sun the dimmed light may sit and still be on the night side. */
const MAX_REACH_RAD = 1.35;

export type Vec3 = readonly [number, number, number];

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: Vec3): Vec3 => {
  const length = Math.hypot(...v) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};

/** City lights show only on the night side, so the light that goes out is the
 *  night-side point nearest the viewer: straight away from the sun when that
 *  faces us, else as far toward us as night reaches (1.35 rad from it, still dark).
 *  `towardSun` and `towardViewer` are directions from the world's centre. */
export function dimSpot(towardSun: Vec3, towardViewer: Vec3): Vec3 {
  const night = unit([-towardSun[0], -towardSun[1], -towardSun[2]]);
  const view = unit(towardViewer);
  const along = dot(night, view);
  const across: Vec3 = [
    view[0] - night[0] * along,
    view[1] - night[1] * along,
    view[2] - night[2] * along,
  ];
  const perpendicular = Math.hypot(...across);
  if (perpendicular < 1e-6) return night;
  const reach = Math.min(Math.acos(Math.min(Math.max(along, -1), 1)), MAX_REACH_RAD);
  const side = unit(across);
  return [
    night[0] * Math.cos(reach) + side[0] * Math.sin(reach),
    night[1] * Math.cos(reach) + side[1] * Math.sin(reach),
    night[2] * Math.cos(reach) + side[2] * Math.sin(reach),
  ];
}
