import { KIND_WORDS, SEVERITY_WORDS, alertMeta } from '../security-words';
import { BeltLayout, PlacedHazard } from './hazard-belts';

/** An alert's mark as a link over the canvas, so it can be hovered, focused and opened on GitHub. */
export interface HazardMark {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  /** The link's width and height, never smaller than a fingertip. */
  readonly hit: number;
  /** Shown on hover and focus. */
  readonly tip: string;
  /** What a screen reader says for it. */
  readonly spoken: string;
  readonly url: string;
}

const MIN_HIT_PX = 24;
const HIT_PER_RADIUS = 3;

function hazardMark(placed: PlacedHazard, now: number): HazardMark | null {
  const { alert } = placed.hazard;
  if (!alert) return null;
  const severity = SEVERITY_WORDS[alert.severity];
  const where = alert.where ? ` · ${alert.where}` : '';
  const meta = alertMeta(alert.kind, alert.number, alert.createdAt, now);
  return {
    key: placed.key,
    x: placed.x,
    y: placed.y,
    hit: Math.max(MIN_HIT_PX, placed.radius * HIT_PER_RADIUS),
    tip: `${severity} · ${KIND_WORDS[alert.kind]}${where}`,
    spoken: `${severity}: ${alert.title}${where}. ${meta}. Opens on GitHub`,
    url: alert.url,
  };
}

/**
 * The links the sky lays over its canvas, most severe first, the order Tab
 * takes, as down the list; `now` is when the report was made. A visitor's
 * hazards carry no alert, so they get none.
 */
export function hazardMarks(layout: BeltLayout, now: number): HazardMark[] {
  return layout.hazards.map((placed) => hazardMark(placed, now)).filter((mark) => mark !== null);
}
