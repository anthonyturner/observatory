import { resolveColour } from '../../../core/instrument/palette';
import { FaultLevel } from '../../../core/logs/log-snapshot';
import { MeteorGeometry } from '../../../core/logs/meteor-record';

/** The meteor record's colours, resolved from tokens.css for the canvas. */
export interface MeteorPalette {
  readonly levels: Readonly<Record<FaultLevel, string>>;
  readonly head: string;
  readonly baseline: string;
}

/** How strongly the traced fault's lifetime shades the strip. */
const LIFETIME_ALPHA = 0.12;

export function readMeteorPalette(element: HTMLElement): MeteorPalette {
  const colour = (token: string) => resolveColour(element, `var(${token})`);
  return {
    levels: { error: colour('--log-error'), warn: colour('--log-warn') },
    head: colour('--meteor-head'),
    baseline: colour('--edge'),
  };
}

/** Draws the strip: the traced fault's lifetime, the baseline, then each day
 *  as a streak rising out of nothing to a white-hot head. */
export function paintMeteors(
  c: CanvasRenderingContext2D,
  geometry: MeteorGeometry,
  look: { readonly palette: MeteorPalette; readonly tracedLevel: FaultLevel | null },
): void {
  const { width, height, lifetime } = geometry;
  const { palette, tracedLevel } = look;
  c.clearRect(0, 0, width, height);
  if (lifetime && tracedLevel) {
    c.fillStyle = palette.levels[tracedLevel];
    c.globalAlpha = LIFETIME_ALPHA;
    c.fillRect(lifetime.x, 0, lifetime.width, height);
    c.globalAlpha = 1;
  }

  c.strokeStyle = palette.baseline;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, height - 0.5);
  c.lineTo(width, height - 0.5);
  c.stroke();

  for (const streak of geometry.streaks) {
    const trail = c.createLinearGradient(0, height, 0, streak.top);
    trail.addColorStop(0, 'transparent');
    trail.addColorStop(1, palette.levels[streak.level]);
    c.strokeStyle = trail;
    c.lineWidth = geometry.lineWidth;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(streak.x, height - 1);
    c.lineTo(streak.x, streak.top);
    c.stroke();
    c.fillStyle = palette.head;
    c.beginPath();
    c.arc(streak.x, streak.top, geometry.headRadius, 0, Math.PI * 2);
    c.fill();
  }
}
