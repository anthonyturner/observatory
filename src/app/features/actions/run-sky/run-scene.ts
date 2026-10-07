import { RUN_OUTCOMES, RunOutcome } from '../../../core/actions/actions-report';
import { clamp01 } from '../../../core/instrument/easing';
import { seededRandom } from '../../../core/instrument/seeded-random';
import { OrreryCamera, Viewport } from '../../../core/orrery/orrery-camera';
import { FieldStar, starField } from '../../../core/orrery/star-field';
import {
  makeGrain,
  paintField,
  paintGlow,
  paintGrain,
  paintVignette,
  rgba,
} from '../../../shared/night-sky/night-sky';
import { SUN_FRAME } from '../../../shared/planets/planet-portrait.types';
import { OrreryPalette } from '../../orrery/orrery-canvas/orrery-palette';
import { paintBackground } from '../../orrery/orrery-canvas/sky-painter';
import { LaneLayout, PlacedLane, PlacedRun } from './run-lanes';
import { OUTCOME_TOKEN, flareReach, isOpen, phaseSeed, pulsePhase } from './run-look';

/** One frame's inputs. */
export interface RunFrame {
  readonly view: Viewport;
  readonly time: number;
  /** Seconds since the runs were laid out, for lighting them in. */
  readonly sinceShown: number;
  readonly selected: string | null;
  /** Motion is off: the grain holds still with the rest. */
  readonly isStill: boolean;
  /** A run's star picture, once painted, else null for the flat glow. */
  readonly portraitOf: (run: PlacedRun) => HTMLImageElement | null;
}

const GRAIN_SEED = 20261008;
const FIELD_STARS = 1400;
const FIELD_SPREAD = 2.4;
/** The field sways a little, so the sky is never quite still while motion is on. */
const FIELD_SWAY = 120;
const FIELD_SWAY_RATE = 0.012;
const LANE_DASH: readonly number[] = [2, 6];
const LANE_ALPHA_FAR = 0.12;
const LANE_ALPHA_NEAR = 0.7;
const NOW_DASH: readonly number[] = [1, 5];
/** The present's line reaches this far past the outer lanes. */
const NOW_OVERHANG_PX = 34;
/** Seconds between one run lighting and the next, oldest first, and each one's fade. */
const LIGHT_STAGGER_S = 0.015;
const LIGHT_FADE_S = 0.6;
const HALO_REACH = 3.2;
const HALO_ALPHA = 0.22;
const FLAT_REACH = 1.25;
const FLARE_GLOW_REACH = 5.5;
const FLARE_GLOW_ALPHA = 0.32;
const FLARE_SPIKE_REACH = 4.2;
const FLARE_SPIKE_WIDTH = 0.18;
/** Each spike turns from the one before: the first 45° off level, the second at right angles to it. */
const FLARE_SPIKE_TURNS: readonly number[] = [Math.PI / 4, Math.PI / 2];
const PULSE_FROM = 1.3;
const PULSE_GROWTH = 2.6;
const PULSE_ALPHA = 0.75;
const FLAKY_RING_REACH = 2.1;
const FLAKY_RING_PAD_PX = 3;
const FLAKY_DASH: readonly number[] = [2, 3];
const FLAKY_TURN = 4;
const FLAKY_TAG_PX = 2.6;
const SELECT_REACH = 2.2;
const SELECT_PAD_PX = 7;
const SELECT_DASH: readonly number[] = [3, 5];
const SELECT_TURN = 6;

const lit = (order: number, sinceShown: number): number =>
  clamp01((sinceShown - order * LIGHT_STAGGER_S) / LIGHT_FADE_S);

/**
 * Draws the Actions sky: the Orrery's night and field stars, each workflow's
 * lane running back from the present, its runs as stars along it, failures
 * flaring, runs still going sending out rings, flaky ones circled, then the
 * vignette and the grain. Everything that moves reads `time`, so it holds
 * still when motion is off.
 */
export class RunScene {
  private readonly field: readonly FieldStar[] = starField(FIELD_STARS, FIELD_SPREAD);
  private readonly camera = new OrreryCamera({ x: 0, y: 0, scale: 1 });
  private readonly grain: HTMLCanvasElement;
  private readonly outcomeInk: Readonly<Record<RunOutcome, string>>;
  private readonly laneInk: string;
  private readonly flakyInk: string;
  private readonly coreInk: string;
  private layout: LaneLayout = { lanes: [], runs: [], nowX: 0 };

  constructor(
    document: Document,
    private readonly palette: OrreryPalette,
  ) {
    this.grain = makeGrain(document, seededRandom(GRAIN_SEED));
    const token = (name: string): string => palette.channels(`var(--${name})`);
    this.outcomeInk = Object.fromEntries(
      RUN_OUTCOMES.map((outcome) => [outcome, token(OUTCOME_TOKEN[outcome])]),
    ) as Record<RunOutcome, string>;
    this.laneInk = token('actions-lane');
    this.flakyInk = token('actions-flaky');
    this.coreInk = token('release-speck');
  }

  /** The colour of a run's star, as an `r, g, b` triple. */
  inkOf(outcome: RunOutcome): string {
    return this.outcomeInk[outcome];
  }

  setLayout(layout: LaneLayout): void {
    this.layout = layout;
  }

  draw(ctx: CanvasRenderingContext2D, frame: RunFrame): void {
    const { view, time } = frame;
    paintBackground(ctx, view, this.palette);
    this.camera.current.x = Math.sin(time * FIELD_SWAY_RATE) * FIELD_SWAY;
    paintField(ctx, this.field, this.camera, view, time, this.palette.stars);
    for (const lane of this.layout.lanes) this.paintLane(ctx, lane);
    this.paintNow(ctx);
    for (const run of this.layout.runs) this.paintRun(ctx, run, frame);
    this.paintSelection(ctx, frame);
    paintVignette(ctx, view, this.palette.vignette);
    paintGrain(ctx, this.grain, view, time, frame.isStill);
  }

  /** Faint in the past, firmer at the present; tinted by how its newest run went. */
  private paintLane(ctx: CanvasRenderingContext2D, lane: PlacedLane): void {
    const ink = lane.newest === 'failed' ? this.outcomeInk.failed : this.laneInk;
    const gradient = ctx.createLinearGradient(lane.far.x, lane.far.y, lane.near.x, lane.near.y);
    gradient.addColorStop(0, rgba(ink, LANE_ALPHA_FAR));
    gradient.addColorStop(1, rgba(ink, LANE_ALPHA_NEAR));
    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1;
    ctx.setLineDash(LANE_DASH);
    ctx.beginPath();
    ctx.moveTo(lane.far.x, lane.far.y);
    ctx.lineTo(lane.near.x, lane.near.y);
    ctx.stroke();
    ctx.restore();
  }

  /** A fine upright line through every lane's present end. */
  private paintNow(ctx: CanvasRenderingContext2D): void {
    const { lanes, nowX } = this.layout;
    if (!lanes.length) return;
    const top = lanes[0].near.y - NOW_OVERHANG_PX;
    const bottom = lanes[lanes.length - 1].near.y + NOW_OVERHANG_PX;
    ctx.save();
    ctx.strokeStyle = rgba(this.laneInk, LANE_ALPHA_NEAR);
    ctx.setLineDash(NOW_DASH);
    ctx.beginPath();
    ctx.moveTo(nowX, top);
    ctx.lineTo(nowX, bottom);
    ctx.stroke();
    ctx.restore();
  }

  private paintRun(ctx: CanvasRenderingContext2D, run: PlacedRun, frame: RunFrame): void {
    const fade = lit(run.order, frame.sinceShown);
    if (fade <= 0) return;
    const { outcome, isFlaky } = run.run;
    const seed = phaseSeed(run.run.id);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (outcome === 'failed') this.paintFlare(ctx, run, frame.time, seed, fade);
    if (isOpen(outcome)) this.paintPulse(ctx, run, pulsePhase(outcome, frame.time, seed), fade);
    this.paintStar(ctx, run, frame, fade);
    ctx.restore();
    if (isFlaky) this.paintFlakyRing(ctx, run, frame.time, fade);
  }

  private paintStar(
    ctx: CanvasRenderingContext2D,
    run: PlacedRun,
    frame: RunFrame,
    fade: number,
  ): void {
    const { x, y, radius } = run;
    const ink = this.outcomeInk[run.run.outcome];
    paintGlow(ctx, { x, y, reach: radius * HALO_REACH }, rgba(ink, HALO_ALPHA * fade));
    const portrait = frame.portraitOf(run);
    if (portrait) {
      const reach = radius * SUN_FRAME;
      ctx.globalAlpha = fade;
      ctx.drawImage(portrait, x - reach, y - reach, reach * 2, reach * 2);
      ctx.globalAlpha = 1;
      return;
    }
    const core = ctx.createRadialGradient(x, y, 0, x, y, radius * FLAT_REACH);
    core.addColorStop(0, rgba(this.coreInk, fade));
    core.addColorStop(0.45, rgba(ink, 0.9 * fade));
    core.addColorStop(1, rgba(ink, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, radius * FLAT_REACH, 0, Math.PI * 2);
    ctx.fill();
  }

  /** A red bloom and four long spikes, breathing on the star's own phase. */
  private paintFlare(
    ctx: CanvasRenderingContext2D,
    run: PlacedRun,
    time: number,
    seed: number,
    fade: number,
  ): void {
    const { x, y, radius } = run;
    const ink = this.outcomeInk.failed;
    const swell = flareReach(time, seed);
    paintGlow(
      ctx,
      { x, y, reach: radius * FLARE_GLOW_REACH * swell },
      rgba(ink, FLARE_GLOW_ALPHA * fade),
    );
    const reach = radius * FLARE_SPIKE_REACH * swell;
    const width = Math.max(1, radius * FLARE_SPIKE_WIDTH);
    const spike = ctx.createLinearGradient(-reach, 0, reach, 0);
    spike.addColorStop(0, rgba(ink, 0));
    spike.addColorStop(0.5, rgba(ink, 0.85 * fade));
    spike.addColorStop(1, rgba(ink, 0));
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = spike;
    // Crossed on the diagonals, so the spikes never lie along a lane.
    for (const turn of FLARE_SPIKE_TURNS) {
      ctx.rotate(turn);
      ctx.fillRect(-reach, -width / 2, reach * 2, width);
    }
    ctx.restore();
  }

  /** A ring leaving the star and fading as it grows. */
  private paintPulse(
    ctx: CanvasRenderingContext2D,
    run: PlacedRun,
    phase: number,
    fade: number,
  ): void {
    const ink = this.outcomeInk[run.run.outcome];
    ctx.strokeStyle = rgba(ink, PULSE_ALPHA * (1 - phase) * fade);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(run.x, run.y, run.radius * (PULSE_FROM + PULSE_GROWTH * phase), 0, Math.PI * 2);
    ctx.stroke();
  }

  /** A dashed amber ring, turning slowly, with a small tag at its top right. */
  private paintFlakyRing(
    ctx: CanvasRenderingContext2D,
    run: PlacedRun,
    time: number,
    fade: number,
  ): void {
    const reach = run.radius * FLAKY_RING_REACH + FLAKY_RING_PAD_PX;
    ctx.save();
    ctx.strokeStyle = rgba(this.flakyInk, 0.85 * fade);
    ctx.lineWidth = 1;
    ctx.setLineDash(FLAKY_DASH);
    ctx.lineDashOffset = -time * FLAKY_TURN;
    ctx.beginPath();
    ctx.arc(run.x, run.y, reach, 0, Math.PI * 2);
    ctx.stroke();
    const tag = { x: run.x + reach * Math.SQRT1_2, y: run.y - reach * Math.SQRT1_2 };
    ctx.fillStyle = rgba(this.flakyInk, fade);
    ctx.beginPath();
    ctx.moveTo(tag.x, tag.y - FLAKY_TAG_PX);
    ctx.lineTo(tag.x + FLAKY_TAG_PX, tag.y);
    ctx.lineTo(tag.x, tag.y + FLAKY_TAG_PX);
    ctx.lineTo(tag.x - FLAKY_TAG_PX, tag.y);
    ctx.fill();
    ctx.restore();
  }

  /** A dashed ring, turning slowly, round the picked run. */
  private paintSelection(ctx: CanvasRenderingContext2D, frame: RunFrame): void {
    const picked = this.layout.runs.find((run) => run.key === frame.selected);
    if (!picked) return;
    ctx.save();
    ctx.strokeStyle = rgba(this.palette.select, 0.75);
    ctx.lineWidth = 1.2;
    ctx.setLineDash(SELECT_DASH);
    ctx.lineDashOffset = -frame.time * SELECT_TURN;
    ctx.beginPath();
    ctx.arc(picked.x, picked.y, picked.radius * SELECT_REACH + SELECT_PAD_PX, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
