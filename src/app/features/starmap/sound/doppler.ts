/* One Doppler rule for everything that moves in the Review Queue sky. A moving
   sound is pitched by how fast the thing the sky draws is closing on the
   viewer, measured from the positions it drew, so what you hear and what you
   see never disagree. The score takes the factor; no layer does audio math. */

/** A place on screen in pixels; `z` is how far it stands toward the viewer from the screen (0 if drawn flat). */
export interface Point {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** The pitch moves by at most this many semitones either way: a lean, never a swoop. */
const MAX_SEMITONES = 3;
/** The closing speed, in pixels a second, at which that limit is reached. */
const FULL_SHIFT_PX_S = 600;

/**
 * Where the viewer sits: the middle of the screen's bottom edge, a half-screen
 * in front of it, looking up at the sky. What falls in the sky comes toward
 * them, and what crosses it passes by.
 */
export function listenerOf(width: number, height: number): Point {
  return { x: width / 2, y: height, z: height / 2 };
}

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** How fast `to` is closing on the listener, in pixels a second; negative when it draws away. */
export function closingSpeed(from: Point, to: Point, seconds: number, listener: Point): number {
  return seconds > 0 ? (distance(from, listener) - distance(to, listener)) / seconds : 0;
}

/** The playback-rate factor for a closing speed: above 1 when approaching, below when receding, 1 when still. */
export function dopplerFactor(closingPxPerS: number): number {
  // A speed that is not a number (a position that was never set) is a thing standing still.
  const share = Math.max(-1, Math.min(1, closingPxPerS / FULL_SHIFT_PX_S || 0));
  return 2 ** ((share * MAX_SEMITONES) / 12);
}

/** The factor for something drawn at `from`, then at `to` `seconds` later. A thing that did not move gets 1. */
export function dopplerOf(from: Point, to: Point, seconds: number, listener: Point): number {
  return dopplerFactor(closingSpeed(from, to, seconds, listener));
}
