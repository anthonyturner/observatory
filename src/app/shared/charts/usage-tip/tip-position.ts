/** Where the pointer is, in viewport pixels. */
export interface Pointer {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** How far the tip keeps from the pointer, and from the window's edges. */
const OFFSET_RIGHT = 14;
const OFFSET_ABOVE = 12;
const OFFSET_BELOW = 16;
const EDGE = 8;

/** Where a tooltip goes: right of the pointer and above it, kept inside the
 *  window, and below the pointer when there is no room above. */
export function tipPosition(
  pointer: Pointer,
  tip: Size,
  viewportWidth: number,
): { readonly left: number; readonly top: number } {
  const left = Math.min(pointer.x + OFFSET_RIGHT, viewportWidth - tip.width - EDGE);
  const above = pointer.y - tip.height - OFFSET_ABOVE;
  return {
    left: Math.max(EDGE, left),
    top: above < EDGE ? pointer.y + OFFSET_BELOW : above,
  };
}
