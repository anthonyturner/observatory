import { DEPLOY_OUTCOMES, DeployOutcome } from '../../../core/deployments/deployments-report';
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
import { flareReach, phaseSeed } from '../../actions/run-sky/run-look';
import { OrreryPalette } from '../../orrery/orrery-canvas/orrery-palette';
import { paintBackground } from '../../orrery/orrery-canvas/sky-painter';
import { OUTCOME_TOKEN, PAD_TOKEN, beaconPulse } from '../deploy-look';
import {
  PAD_FLATTEN,
  PRODUCTION_RING,
  PadLayout,
  PlacedDeployment,
  PlacedPad,
} from './launch-pads';

/** One frame's inputs. */
export interface LaunchFrame {
  readonly view: Viewport;
  readonly time: number;
  /** Motion is off: the grain holds still with the rest. */
  readonly isStill: boolean;
  /** A light's star picture, once painted, else null for the flat glow. */
  readonly portraitOf: (light: PlacedDeployment) => HTMLImageElement | null;
}

const GRAIN_SEED = 20261009;
const FIELD_STARS = 1400;
const FIELD_SPREAD = 2.4;
/** The field sways a little, so the sky is never quite still while motion is on. */
const FIELD_SWAY = 120;
const FIELD_SWAY_RATE = 0.012;
const PAD_LIT_ALPHA = 0.28;
const BEAM_WIDTH_PX = 2;
const BEAM_ALPHA = 0.55;
const TRAIL_DASH: readonly number[] = [2, 6];
const TRAIL_ALPHA = 0.7;
const HALO_REACH = 3.2;
const HALO_ALPHA = 0.22;
const FLAT_REACH = 1.25;
const FLARE_GLOW_REACH = 5;
const FLARE_GLOW_ALPHA = 0.3;
const PULSE_FROM = 1.3;
const PULSE_GROWTH = 2.6;
const PULSE_ALPHA = 0.75;

/**
 * Draws the Deployments sky: the Orrery's night and field stars, each
 * environment's launch pad along the foot, its latest deployment a beacon on a
 * beam above it (a failure flaring, a build under way sending out rings), its
 * earlier deployments a fading trail climbing away, then the vignette and the
 * grain. Everything that moves reads `time`, so it holds still when motion is off.
 */
export class LaunchScene {
  private readonly field: readonly FieldStar[] = starField(FIELD_STARS, FIELD_SPREAD);
  private readonly camera = new OrreryCamera({ x: 0, y: 0, scale: 1 });
  private readonly grain: HTMLCanvasElement;
  private readonly outcomeInk: Readonly<Record<DeployOutcome, string>>;
  private readonly padInk: string;
  private readonly coreInk: string;
  private pads: readonly PlacedPad[] = [];
  /** Each pad's lights, newest first. */
  private trails = new Map<string, readonly PlacedDeployment[]>();
  /** Oldest first, so each pad's beacon is drawn over its trail. */
  private drawOrder: readonly PlacedDeployment[] = [];

  constructor(
    document: Document,
    private readonly palette: OrreryPalette,
  ) {
    this.grain = makeGrain(document, seededRandom(GRAIN_SEED));
    const token = (name: string): string => palette.channels(`var(--${name})`);
    this.outcomeInk = Object.fromEntries(
      DEPLOY_OUTCOMES.map((outcome) => [outcome, token(OUTCOME_TOKEN[outcome])]),
    ) as Record<DeployOutcome, string>;
    this.padInk = token(PAD_TOKEN);
    this.coreInk = token('release-speck');
  }

  /** The colour of a deployment's light, as an `r, g, b` triple. */
  inkOf(outcome: DeployOutcome): string {
    return this.outcomeInk[outcome];
  }

  setLayout(layout: PadLayout): void {
    this.pads = layout.pads;
    this.trails = new Map(
      layout.pads.map((pad) => [
        pad.key,
        layout.deployments.filter((light) => light.padKey === pad.key),
      ]),
    );
    this.drawOrder = [...layout.deployments].reverse();
  }

  draw(ctx: CanvasRenderingContext2D, frame: LaunchFrame): void {
    const { view, time } = frame;
    paintBackground(ctx, view, this.palette);
    this.camera.current.x = Math.sin(time * FIELD_SWAY_RATE) * FIELD_SWAY;
    paintField(ctx, this.field, this.camera, view, time, this.palette.stars);
    for (const pad of this.pads) this.paintPad(ctx, pad);
    for (const pad of this.pads) this.paintTrail(ctx, pad);
    for (const light of this.drawOrder) this.paintLight(ctx, light, frame);
    paintVignette(ctx, view, this.palette.vignette);
    paintGrain(ctx, this.grain, view, time, frame.isStill);
  }

  /** A flat ring on the ground, lit from above in its latest deployment's colour. */
  private paintPad(ctx: CanvasRenderingContext2D, pad: PlacedPad): void {
    const { x, y, reach } = pad;
    const lit = pad.latest ? this.outcomeInk[pad.latest] : this.padInk;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, PAD_FLATTEN);
    const floor = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
    floor.addColorStop(0, rgba(lit, PAD_LIT_ALPHA));
    floor.addColorStop(1, rgba(this.padInk, 0.1));
    ctx.fillStyle = floor;
    ctx.beginPath();
    ctx.arc(0, 0, reach, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this.strokeRing(ctx, pad, 1);
    if (pad.isProduction) this.strokeRing(ctx, pad, PRODUCTION_RING);
  }

  private strokeRing(ctx: CanvasRenderingContext2D, pad: PlacedPad, scale: number): void {
    ctx.save();
    ctx.strokeStyle = rgba(this.padInk, 0.9);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(
      pad.x,
      pad.y,
      pad.reach * scale,
      pad.reach * scale * PAD_FLATTEN,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.restore();
  }

  /** The beam from the pad up to its beacon, and the dashed path its earlier deployments took. */
  private paintTrail(ctx: CanvasRenderingContext2D, pad: PlacedPad): void {
    const lights = this.trails.get(pad.key) ?? [];
    const [beacon] = lights;
    if (!beacon) return;
    const ink = this.outcomeInk[beacon.deployment.outcome];
    const beam = ctx.createLinearGradient(pad.x, pad.y, beacon.x, beacon.y);
    beam.addColorStop(0, rgba(ink, BEAM_ALPHA));
    beam.addColorStop(1, rgba(ink, 0.05));
    ctx.save();
    ctx.strokeStyle = beam;
    ctx.lineWidth = BEAM_WIDTH_PX;
    ctx.beginPath();
    ctx.moveTo(pad.x, pad.y);
    ctx.lineTo(beacon.x, beacon.y);
    ctx.stroke();
    if (lights.length > 1) {
      ctx.strokeStyle = rgba(this.padInk, TRAIL_ALPHA);
      ctx.lineWidth = 1;
      ctx.setLineDash(TRAIL_DASH);
      ctx.beginPath();
      ctx.moveTo(beacon.x, beacon.y);
      for (const light of lights.slice(1)) ctx.lineTo(light.x, light.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private paintLight(
    ctx: CanvasRenderingContext2D,
    light: PlacedDeployment,
    frame: LaunchFrame,
  ): void {
    const { outcome } = light.deployment;
    const seed = phaseSeed(light.deployment.id);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (light.age === 0 && outcome === 'failed') this.paintFlare(ctx, light, frame.time, seed);
    if (light.age === 0 && outcome === 'building') {
      this.paintPulse(ctx, light, beaconPulse(frame.time, seed));
    }
    this.paintStar(ctx, light, frame);
    ctx.restore();
  }

  private paintStar(
    ctx: CanvasRenderingContext2D,
    light: PlacedDeployment,
    frame: LaunchFrame,
  ): void {
    const { x, y, radius, alpha } = light;
    const ink = this.outcomeInk[light.deployment.outcome];
    paintGlow(ctx, { x, y, reach: radius * HALO_REACH }, rgba(ink, HALO_ALPHA * alpha));
    const portrait = frame.portraitOf(light);
    if (portrait) {
      const reach = radius * SUN_FRAME;
      ctx.globalAlpha = alpha;
      ctx.drawImage(portrait, x - reach, y - reach, reach * 2, reach * 2);
      ctx.globalAlpha = 1;
      return;
    }
    const core = ctx.createRadialGradient(x, y, 0, x, y, radius * FLAT_REACH);
    core.addColorStop(0, rgba(this.coreInk, alpha));
    core.addColorStop(0.45, rgba(ink, 0.9 * alpha));
    core.addColorStop(1, rgba(ink, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, radius * FLAT_REACH, 0, Math.PI * 2);
    ctx.fill();
  }

  /** A red bloom breathing on the beacon's own phase. */
  private paintFlare(
    ctx: CanvasRenderingContext2D,
    light: PlacedDeployment,
    time: number,
    seed: number,
  ): void {
    const reach = light.radius * FLARE_GLOW_REACH * flareReach(time, seed);
    paintGlow(
      ctx,
      { x: light.x, y: light.y, reach },
      rgba(this.outcomeInk.failed, FLARE_GLOW_ALPHA),
    );
  }

  /** A ring leaving the beacon and fading as it grows. */
  private paintPulse(ctx: CanvasRenderingContext2D, light: PlacedDeployment, phase: number): void {
    ctx.strokeStyle = rgba(this.outcomeInk.building, PULSE_ALPHA * (1 - phase));
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(light.x, light.y, light.radius * (PULSE_FROM + PULSE_GROWTH * phase), 0, Math.PI * 2);
    ctx.stroke();
  }
}
