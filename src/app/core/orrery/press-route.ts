/** A press that moves less than this, in pixels, is a click, not a drag. */
export const CLICK_SLOP_PX = 5;

/** A finger is wider than the Earth at a phone's Fit, so the Earth is grabbed from at least this far out. */
const MIN_GRAB_RADIUS = 24;

/** What a drag that starts at a press does: turns the Earth, or pans the camera. */
export type PressRoute = 'spin-earth' | 'pan';

/** How far from the Earth's centre, in pixels, a press still grabs it, and how wide the Earth turns under a drag. */
export const grabRadius = (earthRadius: number): number => Math.max(earthRadius, MIN_GRAB_RADIUS);

/** A press that starts on the Earth's disc turns it; anywhere else pans, as it always has. */
export function routePress(
  x: number,
  y: number,
  earth: { readonly x: number; readonly y: number; readonly radius: number },
): PressRoute {
  return Math.hypot(x - earth.x, y - earth.y) < grabRadius(earth.radius) ? 'spin-earth' : 'pan';
}

/** Whether a press that travelled `moved` pixels in all is a click. A drag that turned the Earth is not. */
export const isClick = (moved: number): boolean => moved < CLICK_SLOP_PX;
