import type { Box, Point } from './board-layout.ts';

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Where the board sits in its frame: a board point lands at `scale` times itself, shifted by `x` and `y`. */
export interface Viewport {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export const MIN_SCALE = 0.04;
export const MAX_SCALE = 2.5;

/** The largest a board is blown up to when it is fitted: a small map should not fill the screen. */
const MAX_FIT_SCALE = 1;

const clampScale = (scale: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/** The viewport that shows the whole board, centred, with `margin` clear on every side. */
export function fitViewport(board: Size, frame: Size, margin: number): Viewport {
  const room = {
    width: Math.max(frame.width - 2 * margin, 1),
    height: Math.max(frame.height - 2 * margin, 1),
  };
  const wanted = Math.min(
    room.width / Math.max(board.width, 1),
    room.height / Math.max(board.height, 1),
  );
  const scale = clampScale(Math.min(wanted, MAX_FIT_SCALE));
  return {
    scale,
    x: (frame.width - board.width * scale) / 2,
    y: (frame.height - board.height * scale) / 2,
  };
}

/** Zooms by `factor` while the board point under `focus`, a point of the frame, stays where it is. */
export function zoomAt(viewport: Viewport, factor: number, focus: Point): Viewport {
  const scale = clampScale(viewport.scale * factor);
  const ratio = scale / viewport.scale;
  return {
    scale,
    x: focus.x - (focus.x - viewport.x) * ratio,
    y: focus.y - (focus.y - viewport.y) * ratio,
  };
}

export const panBy = (viewport: Viewport, dx: number, dy: number): Viewport => ({
  ...viewport,
  x: viewport.x + dx,
  y: viewport.y + dy,
});

/** How far to shift one axis so the stretch `from` to `to` sits inside `0` to `room`, by the least. */
function shiftIntoView(from: number, to: number, room: number, margin: number): number {
  if (to - from > room - 2 * margin || from < margin) return margin - from;
  return to > room - margin ? room - margin - to : 0;
}

/** Below this scale a chip is too small to read, so bringing one into view zooms in on it too. */
export const READABLE_SCALE = 0.45;

/** The viewport that shows a box of the board filling the frame, up to full size, centred. */
export function viewportOn(box: Box, frame: Size, margin: number): Viewport {
  const fitted = fitViewport(box, frame, margin);
  return {
    scale: fitted.scale,
    x: fitted.x - box.x * fitted.scale,
    y: fitted.y - box.y * fitted.scale,
  };
}

/**
 * Brings a box of the board into the frame: by the smallest move when the board is big enough to
 * read, else by zooming in on the box. A box too big for the frame at this scale shows its top left.
 */
export function revealBox(viewport: Viewport, box: Box, frame: Size, margin: number): Viewport {
  if (viewport.scale < READABLE_SCALE) return viewportOn(box, frame, margin);
  const left = box.x * viewport.scale + viewport.x;
  const top = box.y * viewport.scale + viewport.y;
  return panBy(
    viewport,
    shiftIntoView(left, left + box.width * viewport.scale, frame.width, margin),
    shiftIntoView(top, top + box.height * viewport.scale, frame.height, margin),
  );
}

export const transformOf = ({ x, y, scale }: Viewport): string =>
  `translate(${x}px, ${y}px) scale(${scale})`;
