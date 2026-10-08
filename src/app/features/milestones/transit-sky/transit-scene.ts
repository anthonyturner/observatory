import { DueState } from '../../../core/milestones/milestones-report';
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
import { WORLD_FRAME } from '../../../shared/planets/planet-portrait.types';
import { flareReach, phaseSeed } from '../../actions/run-sky/run-look';
import { OrreryPalette } from '../../orrery/orrery-canvas/orrery-palette';
import { paintBackground } from '../../orrery/orrery-canvas/sky-painter';
import { DUE_STATES, DUE_TOKEN, LANE_TOKEN } from '../milestone-look';
import { PlacedMilestone, TransitLayout, pointAlong } from './transit-lanes';

/** One frame's inputs. */
export interface TransitFrame {
  readonly view: Viewport;
  readonly time: number;
  /** Motion is off: the grain holds still with the rest. */
  readonly isStill: boolean;
  /** A planet's picture, once painted, else null for the flat lit disc. */
  readonly portraitOf: (lane: PlacedMilestone) => HTMLImageElement | null;
}

const GRAIN_SEED = 20261010;
const FIELD_STARS = 1400;
const FIELD_SPREAD = 2.4;
/** The field sways a little, so the sky is never quite still while motion is on. */
const FIELD_SWAY = 120;
const FIELD_SWAY_RATE = 0.012;
/** Each lane is drawn as this many straight steps. */
const LANE_STEPS = 48;
const LANE_DASH: readonly number[] = [2, 6];
const LANE_ALPHA = 0.8;
const FLOWN_WIDTH_PX = 1.6;
const FLOWN_ALPHA = 0.85;
const WAKE_WIDTH_PX = 7;
const WAKE_ALPHA = 0.12;
const ARRIVAL_RADIUS_PX = 7;
const ARRIVAL_DASH: readonly number[] = [3, 3];
const LAUNCH_RADIUS_PX = 2.2;
const HALO_REACH = 2.6;
const HALO_ALPHA = 0.2;
const OVERDUE_GLOW_REACH = 4.2;
const OVERDUE_GLOW_ALPHA = 0.32;
const BODY_SHADOW = '#000';
/** A hair inside the body's edge, so no dark rim shows round the lit limb. */
const BODY_SHADOW_SHARE = 0.99;
/** The flat disc's light sits toward the upper left, where the portraits' sun is. */
const LIGHT_OFFSET = -0.35;

/**
 * Draws the Milestones sky: the Orrery's night and field stars, each open
 * milestone's lane from launch to arrival with the stretch flown lit in its
 * planet's colour, the planets themselves (an overdue one breathing a red
 * bloom), then the vignette and the grain. Everything that moves reads
 * `time`, so it holds still when motion is off.
 */
export class TransitScene {
  private readonly field: readonly FieldStar[] = starField(FIELD_STARS, FIELD_SPREAD);
  private readonly camera = new OrreryCamera({ x: 0, y: 0, scale: 1 });
  private readonly grain: HTMLCanvasElement;
  private readonly dueInk: Readonly<Record<DueState, string>>;
  private readonly laneInk: string;
  private readonly lightInk: string;
  private lanes: readonly PlacedMilestone[] = [];

  constructor(
    document: Document,
    private readonly palette: OrreryPalette,
  ) {
    this.grain = makeGrain(document, seededRandom(GRAIN_SEED));
    const token = (name: string): string => palette.channels(`var(--${name})`);
    this.dueInk = Object.fromEntries(
      DUE_STATES.map((state) => [state, token(DUE_TOKEN[state])]),
    ) as Record<DueState, string>;
    this.laneInk = token(LANE_TOKEN);
    this.lightInk = token('release-speck');
  }

  /** The colour of a planet's air, as an `r, g, b` triple. */
  inkOf(state: DueState): string {
    return this.dueInk[state];
  }

  setLayout(layout: TransitLayout): void {
    this.lanes = layout.lanes;
  }

  draw(ctx: CanvasRenderingContext2D, frame: TransitFrame): void {
    const { view, time } = frame;
    paintBackground(ctx, view, this.palette);
    this.camera.current.x = Math.sin(time * FIELD_SWAY_RATE) * FIELD_SWAY;
    paintField(ctx, this.field, this.camera, view, time, this.palette.stars);
    for (const lane of this.lanes) this.paintLane(ctx, lane);
    for (const lane of this.lanes) this.paintPlanet(ctx, lane, frame);
    paintVignette(ctx, view, this.palette.vignette);
    paintGrain(ctx, this.grain, view, time, frame.isStill);
  }

  /** The whole lane faintly dashed, the stretch flown lit with a soft wake, and the arrival's ring. */
  private paintLane(ctx: CanvasRenderingContext2D, lane: PlacedMilestone): void {
    const ink = this.dueInk[lane.state];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(this.laneInk, LANE_ALPHA);
    ctx.lineWidth = 1;
    ctx.setLineDash(LANE_DASH);
    this.tracePath(ctx, lane, 1);
    ctx.setLineDash([]);
    if (lane.progress > 0) {
      ctx.strokeStyle = rgba(ink, WAKE_ALPHA);
      ctx.lineWidth = WAKE_WIDTH_PX;
      this.tracePath(ctx, lane, lane.progress);
      ctx.strokeStyle = rgba(ink, FLOWN_ALPHA);
      ctx.lineWidth = FLOWN_WIDTH_PX;
      this.tracePath(ctx, lane, lane.progress);
    }
    ctx.fillStyle = rgba(ink, FLOWN_ALPHA);
    ctx.beginPath();
    ctx.arc(lane.from.x, lane.from.y, LAUNCH_RADIUS_PX, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(lane.state === 'overdue' ? ink : this.laneInk, 1);
    ctx.lineWidth = 1.2;
    ctx.setLineDash(ARRIVAL_DASH);
    ctx.beginPath();
    ctx.arc(lane.to.x, lane.to.y, ARRIVAL_RADIUS_PX, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private tracePath(ctx: CanvasRenderingContext2D, lane: PlacedMilestone, until: number): void {
    const steps = Math.max(1, Math.ceil(LANE_STEPS * until));
    ctx.beginPath();
    ctx.moveTo(lane.from.x, lane.from.y);
    for (let step = 1; step <= steps; step++) {
      const point = pointAlong(lane, (until * step) / steps);
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }

  private paintPlanet(
    ctx: CanvasRenderingContext2D,
    lane: PlacedMilestone,
    frame: TransitFrame,
  ): void {
    const { x, y, radius } = lane;
    const ink = this.dueInk[lane.state];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (lane.state === 'overdue') {
      const seed = phaseSeed(lane.milestone.number);
      const reach = radius * OVERDUE_GLOW_REACH * flareReach(frame.time, seed);
      paintGlow(ctx, { x, y, reach }, rgba(ink, OVERDUE_GLOW_ALPHA));
    }
    paintGlow(ctx, { x, y, reach: radius * HALO_REACH }, rgba(ink, HALO_ALPHA));
    ctx.restore();
    const portrait = frame.portraitOf(lane);
    if (portrait) {
      this.paintPortrait(ctx, lane, portrait);
      return;
    }
    this.paintFlat(ctx, lane, ink);
  }

  /**
   * The painter paints on black, so the picture is screened over the sky to
   * drop it, over a black disc the size of the planet so its lane and the
   * stars do not show through its night side.
   */
  private paintPortrait(
    ctx: CanvasRenderingContext2D,
    lane: PlacedMilestone,
    portrait: HTMLImageElement,
  ): void {
    const { x, y, radius } = lane;
    const reach = radius * WORLD_FRAME;
    ctx.save();
    ctx.fillStyle = BODY_SHADOW;
    ctx.beginPath();
    ctx.arc(x, y, radius * BODY_SHADOW_SHARE, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(portrait, x - reach, y - reach, reach * 2, reach * 2);
    ctx.restore();
  }

  /** A disc lit from the upper left, in its air's colour, until the portrait has loaded. */
  private paintFlat(ctx: CanvasRenderingContext2D, lane: PlacedMilestone, ink: string): void {
    const { x, y, radius } = lane;
    const lit = radius * LIGHT_OFFSET;
    const body = ctx.createRadialGradient(x + lit, y + lit, 0, x, y, radius);
    body.addColorStop(0, rgba(this.lightInk, 0.95));
    body.addColorStop(0.35, rgba(ink, 0.95));
    body.addColorStop(1, rgba(ink, 0.25));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
