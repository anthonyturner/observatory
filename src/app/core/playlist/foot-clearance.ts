/** A box's size in CSS pixels. */
interface Size {
  readonly width: number;
  readonly height: number;
}

/** How far a page's own tools along the foot keep from the playlist, in CSS pixels. */
export interface FootClearance {
  /** From the right edge. */
  readonly right: number;
  /** From the bottom edge. */
  readonly bottom: number;
}

/** The page's gutter from the window's edge, and the gap kept from the playlist. */
const GUTTER_PX = 20;
/** The gap between the bar and the video or track list floating above it. */
const ABOVE_GAP_PX = 8;

/** Where the tools sit: beside the bar while it takes no more than half the window,
 *  wrapping short of it. Otherwise above it in a full row, and then clear of the video
 *  or track list floating over the bar's far end: beside that while it too leaves
 *  half the window, above it once it does not, as on a phone. */
export function footClearanceOf(bar: Size, above: Size, windowWidth: number): FootClearance {
  const half = windowWidth / 2;
  if (bar.width <= half) return { right: bar.width, bottom: 0 };
  if (above.width === 0) return { right: GUTTER_PX, bottom: bar.height };
  const besideAbove = above.width + GUTTER_PX * 2;
  return besideAbove <= half
    ? { right: besideAbove, bottom: bar.height }
    : { right: GUTTER_PX, bottom: bar.height + above.height + ABOVE_GAP_PX };
}

/** How far up from the window's foot the playlist reaches at its far end: the bar,
 *  and the video or track list floating over it whenever either shows. Cards along
 *  the right edge sit above it, so a bigger video lifts them. */
export function playlistReachOf(bar: Size, above: Size): number {
  return above.height === 0 ? bar.height : bar.height + ABOVE_GAP_PX + above.height;
}
