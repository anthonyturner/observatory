import { clamp01 } from '../../../core/instrument/easing';
import { seededRandom } from '../../../core/instrument/seeded-random';
import { OrreryCamera, Viewport } from '../../../core/orrery/orrery-camera';
import { FieldStar, starField } from '../../../core/orrery/star-field';
import { ReleaseTimeline, VersionBump } from '../../../core/releases/release-timeline';
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
import {
  CometFrame,
  CometInks,
  paintCometHead,
  paintIonTail,
  paintTailGlow,
  paintTailSpecks,
} from './comet-painter';
import { PlacedRelease, TimelineLayout } from './release-layout';
import { Stage, pathAt } from './release-path';
import { SpeckDraws, ringSpeck, speckDraws } from './release-specks';

/** One frame's inputs. */
export interface ReleaseFrame {
  readonly view: Viewport;
  readonly stage: Stage;
  readonly time: number;
  /** Seconds since the timeline was laid out, for lighting it in. */
  readonly sinceShown: number;
  readonly selected: string | null;
  /** Motion is off: the grain holds still with the rest. */
  readonly isStill: boolean;
  /** A release's star| null;
  /** A release's star picture, once painted, else null for the flat glow. */
  readonly portraitOf: (release: PlacedRelease) => HTMLImageElement | null;
}

const GRAIN_SEED = 20261007;
const FIELD_STARS = 1400;
const FIELD_SPREAD = 2.4;
/** The field sways a little, so the sky is never quite still while motion is on. */
const FIELD_SWAY = 120;
const FIELD_SWAY_RATE = 0.012;
const PATH_STEPS = 140;
const PATH_DASH: readonly number[] = [2, 7];
const WAKE_STEPS = 48;
const WAKE_REACH_PX = 80;
const WAKE_ALPHA = 0.03;
/** Seconds between one release lighting and the next, oldest first, and each one's fade. */
const LIGHT_STAGGER_S = 0.12;
const LIGHT_FADE_S = 0.8;
const HALO_REACH = 3.4;
const HALO_ALPHA = 0.24;
const FLAT_REACH = 1.25;
const SELECT_REACH = 1.9;
const SELECT_PAD_PX = 7;
const SELECT_DASH: readonly number[] = [3, 5];
const SELECT_TURN = 0.6;
/** A release that shipped hundreds keeps a ring that reads as one, not a cloud; its size still counts them all. */
const RING_SPECK_MAX = 64;
const BUMPS: readonly VersionBump[] = ['major', 'minor', 'patch', 'other'];

/** How lit the `order`th body is, 0 to 1, `sinceShown` seconds after the layout. */
const lit = (order: number, sinceShown: number): number =>
  clamp01((sinceShown - order * LIGHT_STAGGER_S) / LIGHT_FADE_S);

/**
 * Draws the Releases sky: the Orrery's night and field stars, the trajectory,
 * each release as a star ringed by the pull requests it shipped, and the
 * Unreleased comet at the leading edge, then the vignette and the grain.
 */
export class ReleaseScene {
  private readonly field: readonly FieldStar[] = starField(FIELD_STARS, FIELD_SPREAD);
  private readonly camera = new OrreryCamera({ x: 0, y: 0, scale: 1 });
  private readonly grain: HTMLCanvasElement;
  private readonly bumpInk: Readonly<Record<VersionBump, string>>;
  private readonly cometInks: CometInks;
  private layout: TimelineLayout = { releases: [], comet: null };
  private ringDraws = new Map<string, readonly SpeckDraws[]>();
  private tailDraws = new Map<string, readonly SpeckDraws[]>();

  constructor(
    document: Document,
    private readonly palette: OrreryPalette,
  ) {
    this.grain = makeGrain(document, seededRandom(GRAIN_SEED));
    const token = (name: string): string => palette.channels(`var(--${name})`);
    this.bumpInk = Object.fromEntries(
      BUMPS.map((bump) => [bump, token(`release-${bump}`)]),
    ) as Record<VersionBump, string>;
    this.cometInks = {
      comet: token('release-comet'),
      head: token('release-comet-head'),
      speck: token('release-speck'),
    };
  }

  /** The colour of a release's star, as an `r, g, b` triple. */
  inkOf(bump: VersionBump): string {
    return this.bumpInk[bump];
  }

  setLayout(layout: TimelineLayout, timeline: ReleaseTimeline): void {
    this.layout = layout;
    this.ringDraws = new Map(
      timeline.releases.map(({ release }) => [
        release.tag,
        release.pulls.slice(0, RING_SPECK_MAX).map((pull) => speckDraws(pull.number)),
      ]),
    );
    this.tailDraws = new Map(
      (timeline.unreleased?.weeks ?? []).map((week) => [
        week.key,
        week.pulls.map((pull) => speckDraws(pull.number)),
      ]),
    );
  }

  draw(ctx: CanvasRenderingContext2D, frame: ReleaseFrame): void {
    const { view, time } = frame;
    paintBackground(ctx, view, this.palette);
    this.camera.current.x = Math.sin(time * FIELD_SWAY_RATE) * FIELD_SWAY;
    paintField(ctx, this.field, this.camera, view, time, this.palette.stars);
    this.paintPath(ctx, frame.stage);
    for (const release of this.layout.releases) this.paintRelease(ctx, release, frame);
    this.paintComet(ctx, frame);
    this.paintSelection(ctx, frame);
    paintVignette(ctx, view, this.palette.vignette);
    paintGrain(ctx, this.grain, view, time, frame.isStill);
  }

  /** The whole path faintly dashed, and the stretch flown so far, first release to the head, firmer. */
  private paintPath(ctx: CanvasRenderingContext2D, stage: Stage): void {
    const { releases, comet } = this.layout;
    const ink = this.palette.channels('var(--release-path)');
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash(PATH_DASH);
    ctx.strokeStyle = rgba(ink, 0.55);
    this.tracePath(ctx, stage, 0, 1);
    ctx.setLineDash([]);
    const from = releases[0]?.t ?? comet?.tailStart;
    const to = comet?.t ?? releases.at(-1)?.t;
    if (from !== undefined && to !== undefined) {
      this.paintWake(ctx, stage, from, to);
      ctx.strokeStyle = rgba(ink, 0.9);
      this.tracePath(ctx, stage, from, to);
    }
    ctx.restore();
  }

  /** A faint glow along the stretch flown, wider as it nears, so the path reads as a lit lane. */
  private paintWake(ctx: CanvasRenderingContext2D, stage: Stage, from: number, to: number): void {
    const ink = this.bumpInk.minor;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let step = 0; step <= WAKE_STEPS; step++) {
      const point = pathAt(from + ((to - from) * step) / WAKE_STEPS, stage);
      paintGlow(
        ctx,
        { x: point.x, y: point.y, reach: WAKE_REACH_PX * point.depth },
        rgba(ink, WAKE_ALPHA),
      );
    }
    ctx.restore();
  }

  private tracePath(ctx: CanvasRenderingContext2D, stage: Stage, from: number, to: number): void {
    ctx.beginPath();
    for (let step = 0; step <= PATH_STEPS; step++) {
      const point = pathAt(from + ((to - from) * step) / PATH_STEPS, stage);
      if (step === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }

  /** The ring's far side, then the star, then the ring's near side, so the star sits inside it. */
  private paintRelease(
    ctx: CanvasRenderingContext2D,
    release: PlacedRelease,
    frame: ReleaseFrame,
  ): void {
    const fade = lit(release.order, frame.sinceShown);
    if (fade <= 0) return;
    const specks = (this.ringDraws.get(release.key) ?? []).map((draws) =>
      ringSpeck(release, draws, frame.time),
    );
    const speckInk = this.cometInks.speck;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const speck of specks.filter((each) => each.isBehind)) {
      paintSpeck(ctx, speck, rgba(speckInk, speck.alpha * fade));
    }
    this.paintStar(ctx, release, frame, fade);
    for (const speck of specks.filter((each) => !each.isBehind)) {
      paintSpeck(ctx, speck, rgba(speckInk, speck.alpha * fade));
    }
    ctx.restore();
  }

  private paintStar(
    ctx: CanvasRenderingContext2D,
    release: PlacedRelease,
    frame: ReleaseFrame,
    fade: number,
  ): void {
    const { x, y, radius } = release;
    const ink = this.bumpInk[release.bump];
    paintGlow(ctx, { x, y, reach: radius * HALO_REACH }, rgba(ink, HALO_ALPHA * fade));
    const portrait = frame.portraitOf(release);
    if (portrait) {
      const reach = radius * SUN_FRAME;
      ctx.globalAlpha = fade;
      ctx.drawImage(portrait, x - reach, y - reach, reach * 2, reach * 2);
      ctx.globalAlpha = 1;
      return;
    }
    const core = ctx.createRadialGradient(x, y, 0, x, y, radius * FLAT_REACH);
    core.addColorStop(0, rgba(this.cometInks.speck, fade));
    core.addColorStop(0.45, rgba(ink, 0.9 * fade));
    core.addColorStop(1, rgba(ink, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, radius * FLAT_REACH, 0, Math.PI * 2);
    ctx.fill();
  }

  private paintComet(ctx: CanvasRenderingContext2D, frame: ReleaseFrame): void {
    const { comet, releases } = this.layout;
    if (!comet) return;
    const fade = lit(releases.length, frame.sinceShown);
    if (fade <= 0) return;
    const cometFrame: CometFrame = {
      comet,
      stage: frame.stage,
      inks: this.cometInks,
      time: frame.time,
      fade,
    };
    paintTailGlow(ctx, cometFrame);
    paintIonTail(ctx, cometFrame);
    paintTailSpecks(ctx, cometFrame, this.tailDraws);
    paintCometHead(ctx, cometFrame);
  }

  /** A dashed ring, turning slowly, round whatever is picked. */
  private paintSelection(ctx: CanvasRenderingContext2D, frame: ReleaseFrame): void {
    const { comet, releases } = this.layout;
    const picked =
      comet?.key === frame.selected
        ? comet
        : releases.find((release) => release.key === frame.selected);
    if (!picked) return;
    ctx.save();
    ctx.strokeStyle = rgba(this.palette.select, 0.75);
    ctx.lineWidth = 1.2;
    ctx.setLineDash(SELECT_DASH);
    ctx.lineDashOffset = -frame.time * SELECT_TURN * 10;
    ctx.beginPath();
    ctx.arc(picked.x, picked.y, picked.radius * SELECT_REACH + SELECT_PAD_PX, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function paintSpeck(
  ctx: CanvasRenderingContext2D,
  speck: { readonly x: number; readonly y: number; readonly size: number },
  colour: string,
): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(speck.x, speck.y, speck.size, 0, Math.PI * 2);
  ctx.fill();
}
