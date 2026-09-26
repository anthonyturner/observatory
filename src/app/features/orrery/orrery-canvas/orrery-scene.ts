import { seededRandom } from '../../../core/instrument/seeded-random';
import { growth, worldPosition } from '../../../core/orrery/orbit';
import { OrreryCamera, Viewport } from '../../../core/orrery/orrery-camera';
import { DrawnWorld } from '../../../core/orrery/pick-world';
import { FieldStar, starField } from '../../../core/orrery/star-field';
import {
  OrreryWorld,
  openTotal,
  outermostOrbit,
  sunRadius,
} from '../../../core/orrery/world-layout';
import { OrreryPalette } from './orrery-palette';
import {
  makeGrain,
  paintBackground,
  paintDial,
  paintField,
  paintGrain,
  paintVignette,
} from './sky-painter';
import { paintSun, paintSunLabel } from './sun-painter';
import {
  MIN_WORLD_RADIUS,
  PlacedWorld,
  paintOrbit,
  paintWorld,
  paintWorldLabel,
} from './world-painter';

/** The dial sits this far beyond the outermost orbit. */
const DIAL_BEYOND_ORBIT = 100;
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
  private readonly field: readonly FieldStar[] = starField();
  private readonly grain: HTMLCanvasElement;
  private readonly glow: HTMLCanvasElement;

  constructor(
    document: Document,
    private readonly palette: OrreryPalette,
  ) {
    this.grain = makeGrain(document, seededRandom(GRAIN_SEED));
    this.glow = document.createElement('canvas');
  }

  setWorlds(worlds: readonly OrreryWorld[]): void {
    this.worlds = worlds;
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
    paintField(ctx, this.field, camera, view, time, this.palette);
    const dialRadius = (outermostOrbit(this.worlds) + DIAL_BEYOND_ORBIT) * scale;
    if (this.worlds.length) paintDial(ctx, centre, dialRadius, time, scale, this.palette);
    for (const world of placed) paintOrbit(ctx, centre, world, scale, this.palette);

    const sun = sunRadius(this.worlds) * scale;
    this.paintBloom(ctx, view, (glow) => {
      paintSun(glow, centre[0], centre[1], sun, time, this.palette);
      for (const world of placed) paintWorld(glow, world, time, isStill, this.palette);
    });

    paintSunLabel(ctx, centre[0], centre[1], sun, openTotal(this.worlds), scale, this.palette);
    for (const world of placed) paintWorldLabel(ctx, world, scale, this.palette);
    paintVignette(ctx, view, this.palette);
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

  private place(world: OrreryWorld, frame: SceneFrame): PlacedWorld {
    const position = worldPosition(world, frame.time);
    const [x, y] = frame.camera.toScreen(position.x, position.y, frame.view);
    const grow = growth(world, frame.sinceShown);
    return {
      world,
      x,
      y,
      radius: Math.max(world.radius * frame.camera.current.scale, MIN_WORLD_RADIUS) * grow,
      grow,
      color: this.palette.channels(world.color),
      sunward: Math.atan2(-position.y, -position.x),
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
      ['blur(6px)', 0.9],
      ['blur(24px)', 0.36],
      ['none', 1],
    ] as const) {
      ctx.filter = blur;
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.glow, 0, 0, view.width, view.height);
    }
    ctx.restore();
  }
}
