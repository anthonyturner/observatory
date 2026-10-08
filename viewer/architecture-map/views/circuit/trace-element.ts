import { EDGE_KIND_LOOK, MARK_LOOK } from '../../look.ts';
import { svg } from '../../shell/dom.ts';
import type { Point } from './board-layout.ts';
import type { TraceModel } from './board-model.ts';
import { arrowHeadPoints, lengthOf, midpointOf, roundedPath } from './trace-geometry.ts';

const CORNER_RADIUS = 7;
const ARROW_SIZE = 9;
const PULSE_RADIUS = 3;
const PULSE_SPEED = 130;
const PULSE_MIN_SECONDS = 1.6;
const BADGE_HEIGHT = 14;
const BADGE_CHAR_WIDTH = 6.2;
const BADGE_PADDING = 8;

export interface TraceDrawing {
  readonly model: TraceModel;
  readonly element: SVGGElement;
  readonly path: string;
  setPulse(on: boolean): void;
}

function badge(
  className: string,
  at: Point,
  labels: readonly { text: string; colour: string }[],
): SVGGElement | null {
  if (labels.length === 0) return null;
  const text = labels.map((label) => label.text).join(' ');
  const width = text.length * BADGE_CHAR_WIDTH + BADGE_PADDING;
  const colour = labels[0]?.colour ?? '#8795ad';
  return svg(
    'g',
    {
      class: `trace__badge ${className}`,
      transform: `translate(${at.x - width / 2} ${at.y - BADGE_HEIGHT / 2})`,
    },
    svg('rect', { width, height: BADGE_HEIGHT, rx: 3, stroke: colour }),
    svg(
      'text',
      { x: width / 2, y: BADGE_HEIGHT - 3.5, 'text-anchor': 'middle', fill: colour },
      text,
    ),
  );
}

function countLabel(trace: TraceModel): { text: string; colour: string }[] {
  return trace.edges.length > 1
    ? [{ text: `x${trace.edges.length}`, colour: EDGE_KIND_LOOK[trace.kind].colour }]
    : [];
}

function markLabels(trace: TraceModel): { text: string; colour: string }[] {
  return trace.marks.map((mark) => ({ text: MARK_LOOK[mark].tag, colour: MARK_LOOK[mark].colour }));
}

/** The pulse that travels a trace to show which way it carries; the page makes one only where it helps. */
function pulseOn(path: string, colour: string, seconds: number): SVGCircleElement {
  return svg(
    'circle',
    { class: 'trace__pulse', r: PULSE_RADIUS, fill: colour },
    svg('animateMotion', { path, dur: `${seconds}s`, repeatCount: 'indefinite' }),
  );
}

/** One trace as right-angled lines: a glow where it is marked, the line, its arrowhead and, where it needs one, a badge. */
export function traceElement(trace: TraceModel, route: readonly Point[]): TraceDrawing {
  const colour = EDGE_KIND_LOOK[trace.kind].colour;
  const path = roundedPath(route, CORNER_RADIUS);
  const marked = trace.marks.length > 0;
  const middle = midpointOf(route);
  const start = route[0];
  const element = svg(
    'g',
    {
      class: `trace trace--${trace.flow ? 'flow' : 'code'}${marked ? ' is-marked' : ''}`,
      'data-kind': trace.kind,
      'data-marks': trace.marks.join(' '),
    },
    marked
      ? svg('path', {
          class: 'trace__glow',
          d: path,
          stroke: MARK_LOOK[trace.marks[0] ?? 'cycle'].colour,
        })
      : null,
    svg('path', { class: 'trace__line', d: path, stroke: colour }),
    svg('polygon', {
      class: 'trace__head',
      points: arrowHeadPoints(route, ARROW_SIZE),
      fill: colour,
    }),
    start
      ? svg('rect', {
          class: 'trace__via',
          x: start.x - 3,
          y: start.y - 3,
          width: 6,
          height: 6,
          fill: colour,
        })
      : null,
    badge('trace__count', middle, countLabel(trace)),
    badge('trace__marks', { x: middle.x, y: middle.y + BADGE_HEIGHT + 3 }, markLabels(trace)),
  );
  let pulse: SVGCircleElement | null = null;
  return {
    model: trace,
    element,
    path,
    setPulse(on) {
      if (on && !pulse) {
        pulse = pulseOn(path, colour, Math.max(PULSE_MIN_SECONDS, lengthOf(route) / PULSE_SPEED));
        element.append(pulse);
      } else if (!on && pulse) {
        pulse.remove();
        pulse = null;
      }
    },
  };
}
