import { Viewport } from '../../../core/orrery/orrery-camera';
import { rgba } from '../../../shared/night-sky/night-sky';

/** The chart's colours, as `r, g, b` triples, and its fonts. */
export interface ChartPalette {
  readonly skyCentre: string;
  readonly skyMid: string;
  readonly skyEdge: string;
  readonly ink: string;
  readonly muted: string;
  readonly quick: string;
  readonly core: string;
  readonly select: string;
  readonly vignette: string;
  readonly stars: readonly string[];
  readonly fontSans: string;
  readonly fontMono: string;
  readonly fontSerif: string;
  channels(expression: string): string;
}

/** A star as it stands this frame, in screen pixels. */
export interface PlacedStar {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Its bucket's colour, as an `r, g, b` triple. */
  readonly color: string;
  /** 0 to 1: dimmed by the legend's filter and by growing in. */
  readonly alpha: number;
  readonly pulse: number;
  readonly isUrgent: boolean;
  readonly isSelected: boolean;
  /** 0 to 1 through its urgent ring's outward pulse. */
  readonly ringPhase: number;
}

export function paintChartBackground(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  palette: ChartPalette,
): void {
  const { width, height } = view;
  const gradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.46,
    0,
    width * 0.5,
    height * 0.46,
    Math.max(width, height) * 0.85,
  );
  // Deep space is mostly black: a hint of where the galaxy lies, not a wash,
  // or the stars have nothing to be brighter than.
  gradient.addColorStop(0, rgba(palette.skyCentre));
  gradient.addColorStop(0.42, rgba(palette.skyMid));
  gradient.addColorStop(1, rgba(palette.skyEdge));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/** A constellation's stars joined in queue order, breathing slowly. */
export function paintConstellationLine(
  c: CanvasRenderingContext2D,
  points: readonly { readonly x: number; readonly y: number }[],
  color: string,
  alpha: number,
): void {
  if (points.length < 2) return;
  c.save();
  c.globalAlpha = alpha;
  c.strokeStyle = rgba(color);
  c.lineWidth = 1.1;
  c.beginPath();
  points.forEach((point, index) =>
    index === 0 ? c.moveTo(point.x, point.y) : c.lineTo(point.x, point.y),
  );
  c.stroke();
  c.restore();
}

/** A star into the glow layer: its halo, diffraction spikes, body and core. */
export function paintStar(
  c: CanvasRenderingContext2D,
  star: PlacedStar,
  palette: ChartPalette,
): void {
  const { x, y, radius: r, color, alpha, pulse } = star;
  if (alpha <= 0) return;
  c.save();

  // A blocked star sends out a slow ring: the one motion on the chart that means something.
  if (star.isUrgent) {
    c.globalAlpha = alpha * (1 - star.ringPhase) * 0.34;
    c.strokeStyle = rgba(color);
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(x, y, r * (1.4 + star.ringPhase * 4.2), 0, Math.PI * 2);
    c.stroke();
  }

  const glowRadius = r * 3.4 * pulse;
  const glow = c.createRadialGradient(x, y, 0, x, y, glowRadius);
  glow.addColorStop(0, rgba(color));
  glow.addColorStop(0.3, rgba(color, 0.5));
  glow.addColorStop(1, rgba(color, 0));
  c.globalAlpha = 0.5 * alpha * pulse;
  c.fillStyle = glow;
  c.beginPath();
  c.arc(x, y, glowRadius, 0, Math.PI * 2);
  c.fill();

  // Diffraction spikes: what a bright point looks like through a lens, and the
  // cheapest way to make magnitude readable at a glance.
  const spike = r * (2.2 + pulse * 1.8);
  c.globalAlpha = alpha * 0.55 * pulse;
  c.lineWidth = Math.max(r * 0.11, 0.55);
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
  ] as const) {
    const line = c.createLinearGradient(
      x - dx * spike,
      y - dy * spike,
      x + dx * spike,
      y + dy * spike,
    );
    line.addColorStop(0, rgba(color, 0));
    line.addColorStop(0.5, rgba(color));
    line.addColorStop(1, rgba(color, 0));
    c.strokeStyle = line;
    c.beginPath();
    c.moveTo(x - dx * spike, y - dy * spike);
    c.lineTo(x + dx * spike, y + dy * spike);
    c.stroke();
  }

  c.globalAlpha = alpha;
  c.fillStyle = rgba(color);
  c.beginPath();
  c.arc(x, y, r * 0.46, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = alpha * 0.95;
  c.fillStyle = rgba(palette.core);
  c.beginPath();
  c.arc(x, y, r * 0.21 * pulse, 0, Math.PI * 2);
  c.fill();

  if (star.isSelected) paintSelection(c, star, palette);
  c.restore();
}

function paintSelection(
  c: CanvasRenderingContext2D,
  { x, y, radius: r }: PlacedStar,
  palette: ChartPalette,
): void {
  const ring = r * 1.5 + 9;
  c.globalAlpha = 0.95;
  c.strokeStyle = rgba(palette.select);
  c.lineWidth = 1.4;
  c.setLineDash([4, 5]);
  c.beginPath();
  c.arc(x, y, ring, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);
}

/** "Aporia" in the bucket's colour, "CANNOT MERGE · 12" under it. */
export function paintConstellationLabel(
  ctx: CanvasRenderingContext2D,
  at: readonly [number, number],
  name: string,
  detail: string,
  color: string,
  alpha: number,
  scale: number,
  palette: ChartPalette,
): void {
  const zoom = Math.min(scale, 1.2);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.9 * alpha;
  ctx.fillStyle = rgba(color);
  ctx.font = `italic 300 ${Math.max(18, 30 * zoom)}px ${palette.fontSerif}`;
  ctx.fillText(name, at[0], at[1]);
  ctx.globalAlpha = 0.5 * alpha;
  ctx.fillStyle = rgba(palette.muted);
  ctx.font = `500 ${Math.max(9, 10.5 * zoom)}px ${palette.fontMono}`;
  ctx.fillText(detail, at[0], at[1] + 20);
  ctx.restore();
}

/** Titles show only once there is room to read them. */
const TITLE_MIN_SCALE = 1.35;
const TITLE_MAX_LENGTH = 40;

/** "#58" under a star, "✦ quick win" over it, and its title when zoomed in. */
export function paintStarLabel(
  ctx: CanvasRenderingContext2D,
  star: PlacedStar,
  label: { readonly tag: string; readonly title: string; readonly isQuick: boolean },
  scale: number,
  palette: ChartPalette,
): void {
  const { x, y, radius: r, alpha } = star;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.85 * alpha;
  ctx.fillStyle = rgba(palette.ink);
  ctx.font = `500 11px ${palette.fontMono}`;
  ctx.fillText(label.tag, x, y + r * 1.6 + 17);
  if (label.isQuick) {
    ctx.fillStyle = rgba(palette.quick);
    ctx.fillText('✦ quick win', x, y - r * 1.6 - 10);
  }
  if (scale > TITLE_MIN_SCALE) {
    ctx.globalAlpha = 0.5 * alpha;
    ctx.fillStyle = rgba(palette.muted);
    ctx.font = `300 10.5px ${palette.fontSans}`;
    const words =
      label.title.length > TITLE_MAX_LENGTH
        ? `${label.title.slice(0, TITLE_MAX_LENGTH - 2)}…`
        : label.title;
    ctx.fillText(words, x, y + r * 1.6 + 31);
  }
  ctx.restore();
}
