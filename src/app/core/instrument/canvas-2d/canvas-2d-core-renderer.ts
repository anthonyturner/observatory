import { ProjectSnapshot } from '../../projects/project.types';
import { ballCount2D } from '../ball-network';
import { BeadLayout, layoutBeads } from '../beads';
import { CoreLook, breathing, nextLook, tierSpin } from '../core-look';
import { CoreFrame, CoreRenderer } from '../core-renderer';
import { CORE_STATES } from '../core-states';
import { CoreView } from '../core-view';
import { easeOut } from '../easing';
import { buildFloorGrid, floorKey } from '../floor-grid';
import { Lens } from '../lens';
import { BALL } from '../proportions';
import { orbitLoop, tierArcs } from '../rings';
import { BallPainter } from './ball-painter';
import { GlowPainter, GrowingBead } from './glow-painter';
import { floorPaths, paintFloor, paintOverflow, paintRings } from './instrument-painter';
import { CorePalette, readPalette } from './palette';

/** The core grows in over this long on load. */
const INTRO_S = 1.6;
/** Each bead grows in over this long, after its own delay. */
const BEAD_GROW_S = 0.8;
/** The ball starts at this fraction of its size and grows to full with the intro. */
const BALL_START = 0.55;
/** Until the speaking state is wired to a reply, it lights the first tier. */
const SPOKEN_TIER = 0;

interface CoreMoment {
  readonly view: CoreView;
  readonly frame: CoreFrame;
  readonly look: CoreLook;
}

const grown = (elapsedS: number, spanS: number): number => easeOut(elapsedS / spanS);

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
  private look: CoreLook | null = null;
  private bootWall: number | null = null;
  private beadsWall: number | null = null;
  private readonly lens = new Lens();
  private readonly ball = new BallPainter();
  private readonly glow = new GlowPainter();

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    if (this.context) this.palette = readPalette(canvas);
  }

  canDraw(): boolean {
    return this.context !== null;
  }

  setProjects(projects: readonly ProjectSnapshot[]): void {
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
    this.bootWall ??= frame.wall;
    this.beadsWall ??= frame.wall;
    const state = CORE_STATES[frame.state];
    this.look = nextLook(this.look, {
      state,
      tint: palette.inks[state.tint],
      time: frame.time,
      wall: frame.wall,
      isStill: frame.isStill,
    });
    context.setTransform(view.pixelRatio, 0, 0, view.pixelRatio, 0, 0);
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
    context.clearRect(0, 0, view.width, view.height);
    if (!view.isAway) this.paintCore(context, palette, { view, frame, look: this.look });
  }

  dispose(): void {
    this.context = null;
    this.canvas = null;
  }

  private paintCore(
    context: CanvasRenderingContext2D,
    palette: CorePalette,
    { view, frame, look }: CoreMoment,
  ): void {
    const state = CORE_STATES[frame.state];
    const intro = frame.isStill ? 1 : grown(frame.wall - (this.bootWall ?? frame.wall), INTRO_S);
    const breath = breathing(state, frame.time);
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineWidth = 1;
    if (this.floor) {
      paintFloor(context, palette, {
        paths: this.floor.paths,
        centreX: view.centreX,
        centreY: view.centreY,
        fade: intro * view.lift,
      });
    }
    paintRings(context, this.lens, palette, {
      orbit: this.orbit,
      tiers: tierArcs(view.radius, tierSpin(state, frame.time)),
      lit: state.tiers({
        time: frame.time,
        age: frame.stateAge,
        isStill: frame.isStill,
        spokenTier: SPOKEN_TIER,
      }),
      fade: intro,
    });
    this.ball.paint(context, this.lens, {
      look,
      radius: view.radius * BALL * breath * (BALL_START + (1 - BALL_START) * intro),
      level: look.level * intro,
      pointCount: ballCount2D(view.radius),
    });
    context.restore();
    this.glow.paint(context, this.lens, palette, {
      look,
      radius: view.radius,
      breath,
      intro,
      beads: this.growingBeads(frame),
      width: view.width,
      height: view.height,
    });
    if (this.layout.overflow) paintOverflow(context, this.lens, palette, this.layout.overflow);
  }

  private growingBeads(frame: CoreFrame): GrowingBead[] {
    const elapsed = frame.wall - (this.beadsWall ?? frame.wall);
    return this.layout.beads
      .map((bead) => ({
        bead,
        grown: frame.isStill ? 1 : grown(elapsed - bead.delay, BEAD_GROW_S),
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
