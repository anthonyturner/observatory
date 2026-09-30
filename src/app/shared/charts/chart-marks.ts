/** The marks a usage chart is drawn from: plain numbers and words, so the
 *  layout is worked out once in a pure function and the template only places it. */

export type Anchor = 'start' | 'middle' | 'end';

export interface ChartLine {
  readonly x1: number;
  readonly x2: number;
  readonly y1: number;
  readonly y2: number;
}

export interface ChartText {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly anchor: Anchor;
}

export interface ChartBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A transparent box over a mark that carries its tooltip. */
export interface ChartHit extends ChartBox {
  readonly tip: string;
}

/** Where a chart's plot sits inside it. */
export interface Margins {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** How far a label sits from the axis it names. */
const LABEL_GAP = 6;
/** Lifts a label's baseline so it centres on its gridline. */
const LABEL_BASELINE = 3.5;
/** Where the x axis's labels sit, up from the bottom edge. */
export const AXIS_LABEL_RISE = 6;

/** SVG takes any number, but a tenth of a pixel is all the eye can see. */
export const tenth = (value: number): number => Math.round(value * 10) / 10;

/** A horizontal gridline across the plot, labelled at its left. */
export function gridRow(
  y: number,
  from: number,
  to: number,
  label: string,
): { readonly line: ChartLine; readonly label: ChartText } {
  return {
    line: { x1: from, x2: to, y1: y, y2: y },
    label: { x: from - LABEL_GAP, y: y + LABEL_BASELINE, text: label, anchor: 'end' },
  };
}

/** The y of a percent on a plot that runs 0 at the bottom to 100 at the top. */
export function percentY(height: number, margins: Margins): (percent: number) => number {
  const full = 100;
  return (percent) =>
    margins.top + (1 - Math.min(percent, full) / full) * (height - margins.top - margins.bottom);
}
