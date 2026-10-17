import { seededRandom } from '../../../core/instrument/seeded-random';
import { growth, worldPosition } from '../../../core/orrery/orbit';
import { depthAt } from '../../../core/orrery/orrery-camera';
import { OrreryCamera, Viewport } from '../../../core/orrery/orrery-camera';
import { EARTH_RADIUS } from '../../../core/orrery/earth';
import { DrawnWorld, Occluder, isOccluded } from '../../../core/orrery/pick-world';
import { FieldStar, starField } from '../../../core/orrery/star-field';
import {
  SunPlacement,
  dialRadius,
  sunPlacement,
  sunwardAngle,
} from '../../../core/orrery/sun-placement';
import { OrreryWorld, openTotal } from '../../../core/orrery/world-layout';
import { OrreryPalette } from './orrery-palette';
import {
  makeGrain,
  paintField,
  paintGrain,
  paintVignette,
} from '../../../shared/night-sky/night-sky';
import { makeEarthDisc, paintEarth } from './earth-painter';
import { paintBackground, paintDial, paintHouses3D } from './sky-painter';
import { paintSun, paintSunLabel } from './sun-painter';
import {
  MIN_WORLD_RADIUS,
  PlacedWorld,
  paintComets,
  paintOrbit,
  paintSelection,
  paintWorld,
  paintWorldLabel,
} from './world-painter';

const GRAIN_SEED = 20260926;

/** One frame's inputs. */
export interface SceneFrame {
  readonly view: Viewport;
  readonly camera: OrreryCamera;
  readonly time: number;
  /** Seconds since the worlds were laid out, for growing them in. */
  readonly sinceShown: number;
  readonly isStill: boolean;
  readonly selectedKey: string | null;
}

/**
 * Draws the orrery onto a canvas: the sky, the dial, the orbits, then the sun
 * and the worlds into a half-size glow layer that is blurred back over the
 * frame as bloom, then their labels, the vignette and the grain.
 */
export class OrreryScene {
  private worlds: readonly OrreryWorld[] = [];
  private sun: SunPlacement = sunPlacement([]);
  private earthDisc: HTMLCanvasElement | null = null;
  private readonly field: readonly FieldStar[] = starField();
  private readonly grain: HTMLCanvasElement;
  private readonly glow: HTMLCanvasElement;

  constructor(
    private readonly document: Document,
    private readonly palette: OrreryPalette,
  ) {
    this.grain = makeGrain(document, seededRandom(GRAIN_SEED));
    this.glow = document.createElement('canvas');
  }

  setWorlds(worlds: readonly OrreryWorld[]): void {
    this.worlds = worlds;
    this.sun = sunPlacement(worlds);
  }

  /** The Earth's day picture has loaded: from the next frame the Earth is drawn from it. */
  setEarthPicture(day: HTMLImageElement): void {
    this.earthDisc = makeEarthDisc(this.document, day);
  }

  /** The bloom layer runs at half size: it is about to be blurred anyway. */
  resize(view: Viewport): void {
    this.glow.width = Math.max(2, Math.floor(view.width / 2));
    this.glow.height = Math.max(2, Math.floor(view.height / 2));
  }

  /** Draws a frame and returns where each world landed, for picking. */
  draw(ctx: CanvasRenderingContext2D, frame: SceneFrame): DrawnWorld[] {
    const { view, camera, time, isStill } = frame;
    const { scale } = camera.current;
    const centre = camera.toScreen(0, 0, view);
    const placed = this.worlds.map((world) => this.place(world, frame));

    paintBackground(ctx, view, this.palette);
    paintField(ctx, this.field, camera, view, time, this.palette.stars);
    if (this.worlds.length) {
      paintDial(ctx, centre, dialRadius(this.worlds) * scale, time, scale, this.palette);
    }
    for (const world of placed) paintOrbit(ctx, centre, world, scale, this.palette);

    const [sunX, sunY] = camera.toScreen(this.sun.x, this.sun.y, view);
    const sunPx = this.sun.radius * scale;
    const earthSunward = sunwardAngle({ x: 0, y: 0 }, this.sun);
    paintEarth(
      ctx,
      centre[0],
      centre[1],
      EARTH_RADIUS * scale,
      earthSunward,
      this.earthDisc,
      this.palette,
    );
    this.paintBloom(ctx, view, (glow) => {
      paintSun(glow, sunX, sunY, sunPx, time, this.palette);
      for (const world of placed) paintWorld(glow, world, time, isStill, this.palette);
    });

    paintSunLabel(ctx, sunX, sunY, sunPx, openTotal(this.worlds), scale, this.palette);
    for (const world of placed) paintWorldLabel(ctx, world, scale, this.palette);
    paintVignette(ctx, view, this.palette.vignette);
    paintGrain(ctx, this.grain, view, time, isStill);

    return placed
      .filter((world) => world.grow > 0.1)
      .map((world) => ({
        key: world.world.project.repo,
        x: world.x,
        y: world.y,
        radius: world.radius,
      }));
  }

  /** Over the 3D view: what stays sharp through its bloom, the comets, the
   *  names, the house names and the selection ring, placed as the 3D camera
   *  sees them. Returns where each world landed, for picking. */
  drawOverlay(ctx: CanvasRenderingContext2D, frame: SceneFrame): DrawnWorld[] {
    const { view, camera, time, isStill } = frame;
    const { scale } = camera.current;
    const placed = this.worlds.map((world) => this.place(world, frame, true));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const world of placed)
      if (world.grow > 0) paintComets(ctx, world, time, isStill, this.palette);
    ctx.restore();

    const [sunX, sunY] = camera.toScreenAt(this.sun.x, this.sun.y, this.sun.z, view);
    const sunPx = this.sun.radius * scale * depthAt(this.sun.z);
    paintSunLabel(ctx, sunX, sunY, sunPx, openTotal(this.worlds), scale, this.palette);
    for (const world of placed) paintWorldLabel(ctx, world, scale, this.palette);
    if (this.worlds.length) {
      paintHouses3D(ctx, camera, view, dialRadius(this.worlds), time, this.palette);
    }
    for (const world of placed) {
      if (!world.isSelected || world.grow <= 0) continue;
      ctx.save();
      paintSelection(ctx, world, time, this.palette);
      ctx.restore();
    }

    // A world behind the Earth's or the sun's disc is hidden by it, so it cannot be picked there.
    const [earthX, earthY] = camera.toScreenAt(0, 0, 0, view);
    const occluders: Occluder[] = [
      { x: earthX, y: earthY, z: 0, radius: EARTH_RADIUS * scale },
      { x: sunX, y: sunY, z: this.sun.z, radius: sunPx },
    ];
    return placed
      .filter((world) => world.grow > 0.1 && !isOccluded(world, occluders))
      .map((world) => ({
        key: world.world.project.repo,
        x: world.x,
        y: world.y,
        radius: world.radius,
      }));
  }

  private place(
    world: OrreryWorld,
    frame: SceneFrame,
    inDepth = false,
  ): PlacedWorld & { z: number } {
    const position = worldPosition(world, frame.time);
    const { camera, view } = frame;
    const [x, y] = inDepth
      ? camera.toScreenAt(position.x, position.y, position.z, view)
      : camera.toScreen(position.x, position.y, view);
    const depth = inDepth ? depthAt(position.z) : 1;
    const grow = growth(world, frame.sinceShown);
    return {
      world,
      x,
      y,
      z: position.z,
      radius: Math.max(world.radius * camera.current.scale * depth, MIN_WORLD_RADIUS) * grow,
      grow,
      color: this.palette.channels(world.color),
      sunward: sunwardAngle(position, this.sun),
      isSelected: world.project.repo === frame.selectedKey,
    };
  }

  /** Draws into the glow layer, then lays it back three times: a wide soft
   *  bloom, a tight one, and the sharp original on top. */
  private paintBloom(
    ctx: CanvasRenderingContext2D,
    view: Viewport,
    paint: (glow: CanvasRenderingContext2D) => void,
  ): void {
    const glow = this.glow.getContext('2d');
    if (!glow) return;
    glow.setTransform(1, 0, 0, 1, 0, 0);
    glow.clearRect(0, 0, this.glow.width, this.glow.height);
    glow.save();
    glow.scale(0.5, 0.5);
    glow.globalCompositeOperation = 'lighter';
    paint(glow);
    glow.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [blur, alpha] of [
      ['blur(6px)', 0.5],
      ['blur(24px)', 0.12],
      ['none', 1],
    ] as const) {
      ctx.filter = blur;
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.glow, 0, 0, view.width, view.height);
    }
    ctx.restore();
  }
}
