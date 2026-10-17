import { seededRandom } from '../../../core/instrument/seeded-random';
import { OrbitPoint, growth, worldPosition } from '../../../core/orrery/orbit';
import { depthAt } from '../../../core/orrery/orrery-camera';
import { OrreryCamera, Viewport } from '../../../core/orrery/orrery-camera';
import { earthOnScreen } from '../../../core/orrery/earth';
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
import { EarthDisc, paintEarth } from './earth-painter';
import { paintBackground, paintDial, paintHouses3D } from './sky-painter';
import { paintSun, paintSunLabel } from './sun-painter';
import {
  MIN_WORLD_RADIUS,
  PlacedWorld,
  WORLD_HALO_REACH,
  paintComets,
  paintOrbit,
  paintSelection,
  paintWorld,
  paintWorldLabel,
} from './world-painter';

const GRAIN_SEED = 20260926;

/** The Earth sits at the orbit's origin. The sun stands at its depth too (see
 *  `sunPlacement`), so what is behind one is behind the other. */
const EARTH_AT: OrbitPoint = { x: 0, y: 0, z: 0 };

/** A world as placed this frame, with how far toward the viewer it is. */
type PlacedInDepth = PlacedWorld & { readonly z: number };

/** The widest blur laid over the glow, in pixels: how far bloom spreads past a halo. */
const WIDE_BLUR_PX = 24;

/** Where a point of the orrery lands on screen, and how much nearer or farther
 *  than the plane it makes things look. */
type Projection = (
  frame: SceneFrame,
  point: OrbitPoint,
) => { readonly x: number; readonly y: number; readonly depth: number };

/** The 2D view: the plane seen flat. */
const flat: Projection = ({ camera, view }, point) => {
  const [x, y] = camera.toScreen(point.x, point.y, view);
  return { x, y, depth: 1 };
};

/** The 3D view's camera, for the labels and picking over it. */
const perspective: Projection = ({ camera, view }, point) => {
  const [x, y] = camera.toScreenAt(point.x, point.y, point.z, view);
  return { x, y, depth: depthAt(point.z) };
};

/** Whether a world behind the Earth glows over its disc. The glow is additive,
 *  so only such a world's paint order shows; any other can go with the rest. */
const glowsUnderEarth = (world: PlacedInDepth, earth: Occluder): boolean =>
  isOccluded(world, [
    { ...earth, radius: earth.radius + world.radius * WORLD_HALO_REACH + WIDE_BLUR_PX },
  ]);

/** One frame's inputs. */
export interface SceneFrame {
  readonly view: Viewport;
  readonly camera: OrreryCamera;
  readonly time: number;
  /** Seconds since the worlds were laid out, for growing them in. */
  readonly sinceShown: number;
  readonly isStill: boolean;
  readonly selectedKey: string | null;
  /** How far the Earth has turned about its axis, in radians eastward. */
  readonly earthSpin: number;
}

/**
 * Draws the orrery onto a canvas: the sky, the dial, the orbits, then the sun
 * and the worlds into a half-size glow layer that is blurred back over the
 * frame as bloom, then their labels, the vignette and the grain. The Earth goes
 * between two such layers when a world behind it glows over it, so that world
 * is painted first and the Earth covers it.
 */
export class OrreryScene {
  private worlds: readonly OrreryWorld[] = [];
  private sun: SunPlacement = sunPlacement([]);
  private earthDisc: EarthDisc | null = null;
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
    this.earthDisc = EarthDisc.from(this.document, day);
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
    const centre = camera.toScreen(EARTH_AT.x, EARTH_AT.y, view);
    const placed = this.worlds.map((world) => this.place(world, frame, flat));
    const earth = this.earthOccluder(frame);
    const underEarth = placed.filter((world) => glowsUnderEarth(world, earth));
    const overEarth = placed.filter((world) => !underEarth.includes(world));

    paintBackground(ctx, view, this.palette);
    paintField(ctx, this.field, camera, view, time, this.palette.stars);
    if (this.worlds.length) {
      paintDial(ctx, centre, dialRadius(this.worlds) * scale, time, scale, this.palette);
    }
    for (const world of placed) paintOrbit(ctx, centre, world, scale, this.palette);

    const [sunX, sunY] = camera.toScreen(this.sun.x, this.sun.y, view);
    const sunPx = this.sun.radius * scale;
    const earthSunward = sunwardAngle({ x: 0, y: 0 }, this.sun);
    if (underEarth.length) {
      this.paintBloom(ctx, view, (glow) => {
        for (const world of underEarth) paintWorld(glow, world, time, isStill, this.palette);
      });
    }
    paintEarth(
      ctx,
      earth.x,
      earth.y,
      earth.radius,
      earthSunward,
      this.earthDisc?.turnedTo(frame.earthSpin) ?? null,
      this.palette,
    );
    this.paintBloom(ctx, view, (glow) => {
      paintSun(glow, sunX, sunY, sunPx, time, this.palette);
      for (const world of overEarth) paintWorld(glow, world, time, isStill, this.palette);
    });

    paintSunLabel(ctx, sunX, sunY, sunPx, openTotal(this.worlds), scale, this.palette);
    for (const world of placed) paintWorldLabel(ctx, world, scale, this.palette);
    paintVignette(ctx, view, this.palette.vignette);
    paintGrain(ctx, this.grain, view, time, isStill);

    return this.pickable(placed, frame, flat);
  }

  /** Over the 3D view: what stays sharp through its bloom, the comets, the
   *  names, the house names and the selection ring, placed as the 3D camera
   *  sees them. Returns where each world landed, for picking. */
  drawOverlay(ctx: CanvasRenderingContext2D, frame: SceneFrame): DrawnWorld[] {
    const { view, camera, time, isStill } = frame;
    const { scale } = camera.current;
    const placed = this.worlds.map((world) => this.place(world, frame, perspective));
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

    return this.pickable(placed, frame, perspective);
  }

  /** Where each world landed, for picking, less the worlds hidden behind the
   *  Earth's or the sun's disc: what cannot be seen cannot be picked. */
  private pickable(
    placed: readonly PlacedInDepth[],
    frame: SceneFrame,
    project: Projection,
  ): DrawnWorld[] {
    const occluders = [this.earthOccluder(frame), this.sunOccluder(frame, project)];
    return placed
      .filter((world) => world.grow > 0.1 && !isOccluded(world, occluders))
      .map((world) => ({
        key: world.world.project.repo,
        x: world.x,
        y: world.y,
        radius: world.radius,
      }));
  }

  /** At the plane's depth the flat and the 3D views put the Earth in the same place. */
  private earthOccluder(frame: SceneFrame): Occluder {
    return { ...earthOnScreen(frame.camera, frame.view), z: EARTH_AT.z };
  }

  private sunOccluder(frame: SceneFrame, project: Projection): Occluder {
    return this.disc(frame, project, this.sun, this.sun.radius);
  }

  private disc(frame: SceneFrame, project: Projection, body: OrbitPoint, radius: number): Occluder {
    const { x, y, depth } = project(frame, body);
    return { x, y, z: body.z, radius: radius * frame.camera.current.scale * depth };
  }

  private place(world: OrreryWorld, frame: SceneFrame, project: Projection): PlacedInDepth {
    const position = worldPosition(world, frame.time);
    const { x, y, depth } = project(frame, position);
    const grow = growth(world, frame.sinceShown);
    return {
      world,
      x,
      y,
      z: position.z,
      radius: Math.max(world.radius * frame.camera.current.scale * depth, MIN_WORLD_RADIUS) * grow,
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
      [`blur(${WIDE_BLUR_PX}px)`, 0.12],
      ['none', 1],
    ] as const) {
      ctx.filter = blur;
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.glow, 0, 0, view.width, view.height);
    }
    ctx.restore();
  }
}
