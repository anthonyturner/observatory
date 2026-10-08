import { seededRandom } from '../../../core/instrument/seeded-random';
import { OrreryCamera, Viewport } from '../../../core/orrery/orrery-camera';
import { FieldStar, starField } from '../../../core/orrery/star-field';
import { AlertSeverity, SEVERITIES } from '../../../core/security/security-report';
import {
  makeGrain,
  paintField,
  paintGlow,
  paintGrain,
  paintVignette,
  rgba,
} from '../../../shared/night-sky/night-sky';
import { WORLD_FRAME } from '../../../shared/planets/planet-portrait.types';
import { OrreryPalette } from '../../orrery/orrery-canvas/orrery-palette';
import { paintBackground } from '../../orrery/orrery-canvas/sky-painter';
import { BeltLayout, PlacedBelt, PlacedHazard } from './hazard-belts';
import { SEVERITY_TOKEN, outlineOf, throbOf, tumbleOf } from './hazard-look';

/** One frame's inputs. */
export interface HazardFrame {
  readonly view: Viewport;
  readonly time: number;
  /** Motion is off: the grain holds still with the rest. */
  readonly isStill: boolean;
  /** The world's picture, once painted, else null for the flat world. */
  readonly world: HTMLImageElement | null;
  /** The world's air: the worst open grade's colour, as an `r, g, b` triple. */
  readonly air: string;
}

const GRAIN_SEED = 20261009;
const FIELD_STARS = 1400;
const FIELD_SPREAD = 2.4;
const FIELD_SWAY = 120;
const FIELD_SWAY_RATE = 0.012;
const BELT_DASH: readonly number[] = [2, 7];
const BELT_ALPHA_FAR = 0.18;
const BELT_ALPHA_NEAR = 0.42;
const HALO_REACH = 3;
const HALO_ALPHA = 0.28;
const THROB_REACH = 5;
const THROB_ALPHA = 0.3;
const FAR_DIM = 0.6;
const RIM_ALPHA = 0.9;
const AIR_REACH = 1.6;
const AIR_ALPHA = 0.32;
const BODY_SHADOW = '#000';
/** A hair inside the body, so the disc's edge never shows past the painted limb. */
const BODY_SHADOW_SHARE = 0.99;

const HALF_TURN = Math.PI;

/**
 * Draws the Security sky: the Orrery's night and field stars, the project's
 * world in the middle with air the colour of its worst open alert, and each
 * grade's belt of hazards round it, the far half behind the world and the near
 * half in front. Hazards tumble and critical ones throb on scene time, so they
 * hold still when motion is off.
 */
export class HazardScene {
  private readonly field: readonly FieldStar[] = starField(FIELD_STARS, FIELD_SPREAD);
  private readonly camera = new OrreryCamera({ x: 0, y: 0, scale: 1 });
  private readonly grain: HTMLCanvasElement;
  private readonly severityInk: Readonly<Record<AlertSeverity, string>>;
  private readonly beltInk: string;
  private layout: BeltLayout = { centre: { x: 0, y: 0 }, worldRadius: 0, belts: [], hazards: [] };

  constructor(
    document: Document,
    private readonly palette: OrreryPalette,
  ) {
    this.grain = makeGrain(document, seededRandom(GRAIN_SEED));
    const token = (name: string): string => palette.channels(`var(--${name})`);
    this.severityInk = Object.fromEntries(
      SEVERITIES.map((severity) => [severity, token(SEVERITY_TOKEN[severity])]),
    ) as Record<AlertSeverity, string>;
    this.beltInk = token('security-belt');
  }

  setLayout(layout: BeltLayout): void {
    this.layout = layout;
  }

  draw(ctx: CanvasRenderingContext2D, frame: HazardFrame): void {
    const { view, time } = frame;
    paintBackground(ctx, view, this.palette);
    this.camera.current.x = Math.sin(time * FIELD_SWAY_RATE) * FIELD_SWAY;
    paintField(ctx, this.field, this.camera, view, time, this.palette.stars);
    for (const belt of this.layout.belts) this.paintBelt(ctx, belt, false);
    this.paintHazards(ctx, frame, false);
    this.paintWorld(ctx, frame);
    for (const belt of this.layout.belts) this.paintBelt(ctx, belt, true);
    this.paintHazards(ctx, frame, true);
    paintVignette(ctx, view, this.palette.vignette);
    paintGrain(ctx, this.grain, view, time, frame.isStill);
  }

  /** Half a belt: the far half above the world's middle, the near half below it. */
  private paintBelt(ctx: CanvasRenderingContext2D, belt: PlacedBelt, isNear: boolean): void {
    const { x, y } = this.layout.centre;
    const ink = belt.count ? this.severityInk[belt.severity] : this.beltInk;
    const alpha = isNear ? BELT_ALPHA_NEAR : BELT_ALPHA_FAR;
    ctx.save();
    ctx.strokeStyle = rgba(ink, belt.count ? alpha : alpha / 2);
    ctx.lineWidth = 1;
    ctx.setLineDash(BELT_DASH);
    ctx.beginPath();
    const from = isNear ? 0 : HALF_TURN;
    ctx.ellipse(x, y, belt.radiusX, belt.radiusY, 0, from, from + HALF_TURN);
    ctx.stroke();
    ctx.restore();
  }

  private paintHazards(ctx: CanvasRenderingContext2D, frame: HazardFrame, isNear: boolean): void {
    for (const hazard of this.layout.hazards) {
      if (hazard.isNear === isNear) this.paintHazard(ctx, hazard, frame.time);
    }
  }

  private paintHazard(ctx: CanvasRenderingContext2D, placed: PlacedHazard, time: number): void {
    const { x, y, radius, seed, hazard } = placed;
    const ink = this.severityInk[hazard.severity];
    const dim = placed.isNear ? 1 : FAR_DIM;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (hazard.severity === 'critical') {
      const throb = throbOf(time, seed);
      paintGlow(ctx, { x, y, reach: radius * THROB_REACH }, rgba(ink, THROB_ALPHA * throb * dim));
    }
    paintGlow(ctx, { x, y, reach: radius * HALO_REACH }, rgba(ink, HALO_ALPHA * dim));
    ctx.restore();
    this.paintBody(ctx, placed, time);
  }

  /** The hazard's shape, lit from the upper left, with a rim of its grade's colour. */
  private paintBody(ctx: CanvasRenderingContext2D, placed: PlacedHazard, time: number): void {
    const { x, y, radius, seed, hazard } = placed;
    const outline = outlineOf(hazard.kind, seed);
    const rim = rgba(this.severityInk[hazard.severity], placed.isNear ? 1 : FAR_DIM);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tumbleOf(time, seed));
    ctx.beginPath();
    outline.forEach((point, index) => {
      const [px, py] = [point.x * radius, point.y * radius];
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    const light = ctx.createLinearGradient(-radius, -radius, radius, radius);
    light.addColorStop(0, rgba(this.palette.worldLight, 0.95));
    light.addColorStop(1, rgba(this.palette.worldShade, 0.95));
    ctx.fillStyle = light;
    ctx.fill();
    ctx.globalAlpha = RIM_ALPHA;
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /** The project's world, its air the colour of its worst open alert. */
  private paintWorld(ctx: CanvasRenderingContext2D, frame: HazardFrame): void {
    const { centre, worldRadius: radius } = this.layout;
    if (radius <= 0) return;
    paintGlow(ctx, { ...centre, reach: radius * AIR_REACH }, rgba(frame.air, AIR_ALPHA));
    if (frame.world) {
      this.paintPortrait(ctx, frame.world);
      return;
    }
    const body = ctx.createRadialGradient(
      centre.x - radius * 0.35,
      centre.y - radius * 0.35,
      radius * 0.1,
      centre.x,
      centre.y,
      radius,
    );
    body.addColorStop(0, rgba(this.palette.worldLight));
    body.addColorStop(1, rgba(this.palette.worldShade));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * The painter paints on black, so the picture is screened over the sky to
   * drop it, over a black disc the size of the world's body so the far belt
   * and the stars do not show through its night side.
   */
  private paintPortrait(ctx: CanvasRenderingContext2D, world: HTMLImageElement): void {
    const { centre, worldRadius: radius } = this.layout;
    const reach = radius * WORLD_FRAME;
    ctx.save();
    ctx.fillStyle = BODY_SHADOW;
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, radius * BODY_SHADOW_SHARE, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(world, centre.x - reach, centre.y - reach, reach * 2, reach * 2);
    ctx.restore();
  }
}
