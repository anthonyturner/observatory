import { rgba } from '../../../shared/night-sky/night-sky';
import { PlacedComet } from './release-layout';
import { Stage, pathAt } from './release-path';
import { SkyMoment, SpeckDraws, tailSpeck } from './release-specks';

/* The Unreleased comet: a dust tail that widens and fades back along the
   path through each week's knot, a fine straight ion tail, and a head of
   coma and nucleus at the leading edge. */

export interface CometInks {
  readonly comet: string;
  readonly head: string;
  readonly speck: string;
}

/** Everything one frame of the comet is drawn from. */
export interface CometFrame {
  readonly comet: PlacedComet;
  readonly stage: Stage;
  readonly inks: CometInks;
  readonly time: number;
  /** 0 to 1 as it fades in. */
  readonly fade: number;
}

const TAIL_STEPS = 90;
const TAIL_NEAR_PX = 10;
const TAIL_FAR_PX = 48;
const TAIL_ALPHA_MIN = 0.03;
const TAIL_ALPHA_GAIN = 0.26;
/** Where along the dust tail the ion tail aims, how far past that it reaches, and how far it lifts off it. */
const ION_AIM = 0.45;
const ION_REACH = 1.15;
const ION_LIFT = 0.12;
const ION_WIDTH_PX = 1.4;
const COMA_REACH = 4.2;
const NUCLEUS_REACH = 1.25;
const CORE_REACH = 0.45;
const BREATH_RATE = 1.3;
const BREATH_DEPTH = 0.08;

/** The dust tail: soft overlapping glows from the far end to the head, brighter toward the head. */
export function paintTailGlow(ctx: CanvasRenderingContext2D, frame: CometFrame): void {
  const { comet, stage, inks, fade } = frame;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let step = 0; step <= TAIL_STEPS; step++) {
    const share = step / TAIL_STEPS;
    const point = pathAt(comet.tailStart + (comet.t - comet.tailStart) * share, stage);
    const reach = point.depth * (TAIL_NEAR_PX + TAIL_FAR_PX * (1 - share));
    const alpha = (TAIL_ALPHA_MIN + TAIL_ALPHA_GAIN * share * share) * fade;
    const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, reach);
    glow.addColorStop(0, rgba(inks.comet, alpha));
    glow.addColorStop(1, rgba(inks.comet, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(point.x - reach, point.y - reach, reach * 2, reach * 2);
  }
  ctx.restore();
}

/** The ion tail: a fine straight line from the head toward the dust tail's middle, a little
 *  above it, as a real one points away from its sun while the dust curves behind. */
export function paintIonTail(ctx: CanvasRenderingContext2D, frame: CometFrame): void {
  const { comet, stage, inks, fade } = frame;
  const toward = pathAt(comet.tailStart + (comet.t - comet.tailStart) * ION_AIM, stage);
  const [dx, dy] = [toward.x - comet.x, toward.y - comet.y];
  const endX = comet.x + (dx + dy * ION_LIFT) * ION_REACH;
  const endY = comet.y + (dy - dx * ION_LIFT) * ION_REACH;
  const line = ctx.createLinearGradient(comet.x, comet.y, endX, endY);
  line.addColorStop(0, rgba(inks.head, 0.45 * fade));
  line.addColorStop(1, rgba(inks.comet, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = line;
  ctx.lineWidth = ION_WIDTH_PX * comet.depth;
  ctx.beginPath();
  ctx.moveTo(comet.x, comet.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.restore();
}

/** Every unreleased pull request, streaming back through its week's knot. */
export function paintTailSpecks(
  ctx: CanvasRenderingContext2D,
  frame: CometFrame,
  draws: ReadonlyMap<string, readonly SpeckDraws[]>,
): void {
  const { comet, inks, fade } = frame;
  const moment: SkyMoment = { time: frame.time, stage: frame.stage };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const week of comet.weeks) {
    for (const each of draws.get(week.key) ?? []) {
      const speck = tailSpeck(week, each, moment);
      ctx.fillStyle = rgba(inks.speck, speck.alpha * fade);
      ctx.beginPath();
      ctx.arc(speck.x, speck.y, speck.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** The head: a coma that breathes with the scene's time, round a bright nucleus. */
export function paintCometHead(ctx: CanvasRenderingContext2D, frame: CometFrame): void {
  const { comet, inks, fade } = frame;
  const { x, y, radius } = comet;
  const breath = 1 + Math.sin(frame.time * BREATH_RATE) * BREATH_DEPTH;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = (reach: number, ink: string, alpha: number): void => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, reach);
    gradient.addColorStop(0, rgba(ink, alpha * fade));
    gradient.addColorStop(1, rgba(ink, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(x - reach, y - reach, reach * 2, reach * 2);
  };
  glow(radius * COMA_REACH * breath, inks.comet, 0.32);
  glow(radius * NUCLEUS_REACH, inks.head, 0.85);
  glow(radius * CORE_REACH, inks.speck, 1);
  ctx.restore();
}
