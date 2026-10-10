export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** A stretch of the drawing in its own units; `x` and `y` are its top-left corner and may be negative. */
export interface Area extends Point, Size {}

/** Where the drawing sits in its frame: a drawing point lands at `scale` times itself, shifted by `x` and `y` pixels. */
export interface Viewport {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 4;
/** Below this, labels drawn at 11px fall under about 9px and stop being readable. */
export const READABLE_SCALE = 0.8;
/** The most a small drawing is blown up to fill its frame. */
const MAX_FIT_SCALE = 1.5;

const clampScale = (scale: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

const centreOf = (area: Area): Point => ({
  x: area.x + area.width / 2,
  y: area.y + area.height / 2,
});

/** The viewport at `scale` that puts the drawing point `point` at the centre of the frame. */
export function centredOn(point: Point, scale: number, frame: Size): Viewport {
  const clamped = clampScale(scale);
  return {
    scale: clamped,
    x: frame.width / 2 - point.x * clamped,
    y: frame.height / 2 - point.y * clamped,
  };
}

/** The viewport that shows the whole area, centred, with `margin` pixels clear on every side. */
export function fitViewport(area: Area, frame: Size, margin: number): Viewport {
  const room = {
    width: Math.max(frame.width - 2 * margin, 1),
    height: Math.max(frame.height - 2 * margin, 1),
  };
  const wanted = Math.min(
    room.width / Math.max(area.width, 1),
    room.height / Math.max(area.height, 1),
  );
  return centredOn(centreOf(area), Math.min(wanted, MAX_FIT_SCALE), frame);
}

/** The first look at a drawing: whole when it fits at a readable size, else readable and centred. */
export function startViewport(area: Area, frame: Size, margin: number): Viewport {
  const fitted = fitViewport(area, frame, margin);
  return fitted.scale >= READABLE_SCALE ? fitted : centredOn(centreOf(area), READABLE_SCALE, frame);
}

/** A new drawing at the scale of the one before, centred, so recentring keeps the zoom chosen. */
export const recentred = (viewport: Viewport, area: Area, frame: Size): Viewport =>
  centredOn(centreOf(area), viewport.scale, frame);

/** Zooms by `factor` while the drawing point under `focus`, a point of the frame, stays where it is. */
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

/** Keeps the drawing point at the frame's centre where it was when the frame changes size. */
export const resized = (viewport: Viewport, before: Size, after: Size): Viewport =>
  panBy(viewport, (after.width - before.width) / 2, (after.height - before.height) / 2);

/** The viewport as an SVG `transform` attribute. */
export const svgTransformOf = ({ x, y, scale }: Viewport): string =>
  `translate(${x} ${y}) scale(${scale})`;
