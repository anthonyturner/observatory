import type { Point } from './board-layout.ts';

const sameSpot = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

/** The route with repeated points removed, so no segment has zero length. */
function distinct(points: readonly Point[]): Point[] {
  return points.filter((point, at) => at === 0 || !sameSpot(point, points[at - 1]));
}

const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

const round = (value: number): number => Math.round(value * 100) / 100;

/** A point `by` along the way from `from` to `to`. */
function toward(from: Point, to: Point, by: number): Point {
  const length = distance(from, to);
  return {
    x: from.x + ((to.x - from.x) * by) / length,
    y: from.y + ((to.y - from.y) * by) / length,
  };
}

/** SVG path data for a route, with each corner rounded by up to `radius` and never past a segment's middle. */
export function roundedPath(route: readonly Point[], radius: number): string {
  const points = distinct(route);
  const first = points[0];
  if (!first) return '';
  const spot = ({ x, y }: Point): string => `${round(x)} ${round(y)}`;
  let path = `M${spot(first)}`;
  for (let at = 1; at < points.length; at++) {
    const corner = points[at];
    const before = points[at - 1];
    const after = points[at + 1];
    if (!after) {
      path += ` L${spot(corner)}`;
      continue;
    }
    const cut = Math.min(radius, distance(before, corner) / 2, distance(corner, after) / 2);
    path += ` L${spot(toward(corner, before, cut))} Q${spot(corner)} ${spot(toward(corner, after, cut))}`;
  }
  return path;
}

export function lengthOf(route: readonly Point[]): number {
  const points = distinct(route);
  return points.slice(1).reduce((sum, point, at) => sum + distance(points[at], point), 0);
}

/** The point halfway along the route, by length, where a trace carries its count and its marks. */
export function midpointOf(route: readonly Point[]): Point {
  const points = distinct(route);
  const first = points[0];
  if (!first) return { x: 0, y: 0 };
  let remaining = lengthOf(points) / 2;
  for (let at = 1; at < points.length; at++) {
    const from = points[at - 1];
    const to = points[at];
    const length = distance(from, to);
    if (remaining <= length) return toward(from, to, remaining);
    remaining -= length;
  }
  return points.at(-1) ?? first;
}

/** SVG `points` for an arrowhead whose tip is the end of the route. */
export function arrowHeadPoints(route: readonly Point[], size: number): string {
  const points = distinct(route);
  const tip = points.at(-1);
  const before = points.at(-2);
  if (!tip || !before) return '';
  const base = toward(tip, before, size);
  const side = {
    x: ((tip.y - before.y) / distance(before, tip)) * size * 0.55,
    y: (-(tip.x - before.x) / distance(before, tip)) * size * 0.55,
  };
  return [
    tip,
    { x: base.x + side.x, y: base.y + side.y },
    { x: base.x - side.x, y: base.y - side.y },
  ]
    .map(({ x, y }) => `${round(x)},${round(y)}`)
    .join(' ');
}
