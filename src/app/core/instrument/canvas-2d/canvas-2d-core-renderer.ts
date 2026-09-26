import { ProjectSnapshot } from '../../projects/project.types';
import { ballCount2D } from '../ball-network';
import { BeadLayout, layoutBeads, stalePulse } from '../beads';
import { CoreAnimator, CorePose, ballRadiusOf, beadGrowth } from '../core-animator';
import { CoreFrame, CoreRenderer } from '../core-renderer';
import { CoreView } from '../core-view';
import { buildFloorGrid, floorKey } from '../floor-grid';
import { layerCanvas } from '../layer-canvas';
import { Lens } from '../lens';
import { orbitLoop, tierArcs } from '../rings';
import { BallPainter } from './ball-painter';
import { GlowPainter, GrowingBead } from './glow-painter';
import { floorPaths, paintFloor, paintOverflow, paintRings } from './instrument-painter';
import { CorePalette, readPalette } from '../palette';

/** The core drawn with Canvas 2D: everything on one canvas, laid over the sky. */
export class Canvas2DCoreRenderer implements CoreRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private palette: CorePalette | null = null;
  private view: CoreView | null = null;
  private projects: readonly ProjectSnapshot[] = [];
  private layout: BeadLayout = { beads: [], overflow: null };
  private orbit: Float32Array = new Float32Array(0);
  private floor: { key: string; paths: ReturnType<typeof floorPaths> } | null = null;
  private readonly animator = new CoreAnimator();
  private readonly lens = new Lens();
  private readonly ball = new BallPainter();
  private readonly glow = new GlowPainter();

  mount(host: HTMLElement): void {
    this.canvas = layerCanvas(host);
    this.context = this.canvas.getContext('2d');
    if (this.context) this.palette = readPalette(host);
    if (this.view) this.resizeCanvas(this.view);
  }

  canDraw(): boolean {
    return this.context !== null;
  }

  setProjects(projects: readonly ProjectSnapshot[]): void {
    if (this.projects.length === 0 && projects.length > 0) this.animator.replayBeads();
    this.projects = projects;
    this.relayout();
  }

  setView(view: CoreView): void {
    const resized = view.radius !== this.view?.radius;
    const rescaled =
      view.width !== this.view?.width ||
      view.height !== this.view?.height ||
      view.pixelRatio !== this.view?.pixelRatio;
    this.view = view;
    this.lens.aim(view);
    if (rescaled) this.resizeCanvas(view);
    if (resized) this.relayout();
    this.refloor(view);
  }

  frame(frame: CoreFrame): void {
    const { context, palette, view } = this;
    if (!context || !palette || !view) return;
    this.animator.advance(frame, palette.inks);
    context.setTransform(view.pixelRatio, 0, 0, view.pixelRatio, 0, 0);
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
    context.clearRect(0, 0, view.width, view.height);
    const pose = this.animator.pose;
    if (pose && !view.isAway) this.paintCore(context, palette, { view, pose, frame });
  }

  dispose(): void {
    this.canvas?.remove();
    this.context = null;
    this.canvas = null;
  }

  private paintCore(
    context: CanvasRenderingContext2D,
    palette: CorePalette,
    { view, pose, frame }: { view: CoreView; pose: CorePose; frame: CoreFrame },
  ): void {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineWidth = 1;
    if (this.floor) {
      paintFloor(context, palette, {
        paths: this.floor.paths,
        centreX: view.centreX,
        centreY: view.centreY,
        fade: pose.intro * view.lift,
      });
    }
    paintRings(context, this.lens, palette, {
      orbit: this.orbit,
      tiers: tierArcs(view.radius, pose.tierSpin),
      lit: pose.tierLevels,
      fade: pose.intro,
    });
    this.ball.paint(context, this.lens, {
      look: pose.look,
      radius: ballRadiusOf(pose, view.radius),
      level: pose.look.level * pose.intro,
      pointCount: ballCount2D(view.radius),
      yaw: pose.look.spin + frame.hand.yaw,
      pitch: frame.hand.pitch,
      hand: frame.hand,
      isStill: frame.isStill,
    });
    context.restore();
    this.glow.paint(context, this.lens, palette, {
      look: pose.look,
      radius: view.radius,
      breath: pose.breath,
      intro: pose.intro,
      beads: this.growingBeads(pose, frame),
      width: view.width,
      height: view.height,
    });
    if (this.layout.overflow) paintOverflow(context, this.lens, palette, this.layout.overflow);
  }

  private growingBeads(pose: CorePose, frame: CoreFrame): GrowingBead[] {
    return this.layout.beads
      .map((bead) => ({
        bead,
        grown: beadGrowth(pose, bead),
        isLit: bead.key === frame.litKey,
        stalePulse: stalePulse(bead.staleness, frame.time, frame.isStill),
      }))
      .filter((growing) => growing.grown > 0);
  }

  private resizeCanvas(view: CoreView): void {
    if (!this.canvas) return;
    this.canvas.width = Math.floor(view.width * view.pixelRatio);
    this.canvas.height = Math.floor(view.height * view.pixelRatio);
    this.glow.resize(view.width, view.height);
  }

  private relayout(): void {
    const radius = this.view?.radius;
    if (radius === undefined) return;
    this.layout = layoutBeads(this.projects, radius);
    this.orbit = orbitLoop(radius);
  }

  private refloor(view: CoreView): void {
    const size = { coreRadius: view.radius, windowWidth: view.width, depth: view.floorDepth };
    if (this.floor?.key === floorKey(size)) return;
    const grid = buildFloorGrid(size);
    this.floor = { key: grid.key, paths: floorPaths(grid) };
  }
}
