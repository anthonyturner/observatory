import { seededRandom } from '../../../core/instrument/seeded-random';
import { OrreryCamera, Viewport } from '../../../core/orrery/orrery-camera';
import { DrawnWorld } from '../../../core/orrery/pick-world';
import { FieldStar, starField } from '../../../core/orrery/star-field';
import { ChangeMark } from '../../../core/queue/changes';
import {
  ChartStar,
  StarChartLayout,
  starGrowth,
  starPosition,
  starPulse,
} from '../../../core/queue/star-layout';
import {
  makeGrain,
  paintField,
  paintGrain,
  paintVignette,
} from '../../../shared/night-sky/night-sky';
import { BUCKET_LOOK, QUICK_FILTER, QueueFilter, isQuickWin } from '../queue-view';
import {
  ChartPalette,
  PlacedStar,
  paintChartBackground,
  paintConstellationLabel,
  paintConstellationLine,
  paintStar,
  paintStarLabel,
} from './chart-painter';

/** A filtered-out star stays, faint, so the shape of the queue still reads. */
const DIMMED = 0.1;
/** Labels only once stars are big enough to tell apart. */
const LABEL_MIN_SCALE = 0.5;
const LABEL_MIN_GROWTH = 0.6;
/** Stars never shrink below this share of their size, however far out. */
const MIN_STAR_SCALE = 0.42;
const RING_PERIOD = 0.42;
const MARK_PERIOD = 0.55;
/** Where a still page shows a mark's rings: part way out, so all can be seen. */
const STILL_MARK_PHASE = 0.3;
const LABEL_BELOW = 80;
const GRAIN_SEED = 20260926;

export interface ChartFrame {
  readonly view: Viewport;
  readonly camera: OrreryCamera;
  readonly time: number;
  readonly sinceShown: number;
  readonly isStill: boolean;
  readonly filter: QueueFilter;
  readonly selected: number | null;
  readonly marks: ReadonlyMap<number, ChangeMark>;
}

const passes = (star: ChartStar, filter: QueueFilter): boolean =>
  !filter || (filter === QUICK_FILTER ? isQuickWin(star.item) : star.bucket === filter);

/** Draws the star map: the sky, the constellations and their stars with bloom, the labels. */
export class ChartScene {
  private layout: StarChartLayout | null = null;
  private readonly field: readonly FieldStar[] = starField();
  private readonly grain: HTMLCanvasElement;
  private readonly glow: HTMLCanvasElement;

  constructor(
    document: Document,
    private readonly palette: ChartPalette,
  ) {
    this.grain = makeGrain(document, seededRandom(GRAIN_SEED));
    this.glow = document.createElement('canvas');
  }

  setLayout(layout: StarChartLayout): void {
    this.layout = layout;
  }

  resize(view: Viewport): void {
    this.glow.width = Math.max(2, Math.floor(view.width / 2));
    this.glow.height = Math.max(2, Math.floor(view.height / 2));
  }

  /** Draws a frame and returns where each star landed, for picking. */
  draw(ctx: CanvasRenderingContext2D, frame: ChartFrame): DrawnWorld[] {
    const { view, camera, time, isStill } = frame;
    const { scale } = camera.current;
    paintChartBackground(ctx, view, this.palette);
    paintField(ctx, this.field, camera, view, time, this.palette.stars);
    const constellations = (this.layout?.constellations ?? []).map((constellation) => ({
      constellation,
      color: this.palette.channels(BUCKET_LOOK[constellation.bucket].color),
      stars: constellation.stars.map((star) => ({ star, placed: this.place(star, frame) })),
    }));

    this.paintBloom(ctx, view, (glow) => {
      for (const { constellation, color, stars } of constellations) {
        const breath = 0.42 + Math.sin(time * 0.62 + constellation.centreX * 0.004) * 0.13;
        const anyShown = stars.some(({ star }) => passes(star, frame.filter));
        paintConstellationLine(
          glow,
          stars.map(({ placed }) => placed),
          color,
          breath * (anyShown ? 1 : DIMMED),
        );
        for (const { placed } of stars) paintStar(glow, placed, this.palette);
      }
    });

    for (const { constellation, color, stars } of constellations) {
      const look = BUCKET_LOOK[constellation.bucket];
      const anyShown = stars.some(({ star }) => passes(star, frame.filter));
      const lowest = Math.max(...constellation.stars.map((star) => star.y));
      paintConstellationLabel(
        ctx,
        camera.toScreen(constellation.centreX, lowest + LABEL_BELOW, view),
        look.name,
        `${look.meaning.toUpperCase()} · ${constellation.stars.length}`,
        color,
        anyShown ? 1 : DIMMED,
        scale,
        this.palette,
      );
      if (scale <= LABEL_MIN_SCALE) continue;
      for (const { star, placed } of stars) {
        if (placed.alpha < LABEL_MIN_GROWTH * DIMMED) continue;
        paintStarLabel(
          ctx,
          placed,
          { tag: `#${star.item.number}`, title: star.item.title, isQuick: isQuickWin(star.item) },
          scale,
          this.palette,
        );
      }
    }
    paintVignette(ctx, view, this.palette.vignette);
    paintGrain(ctx, this.grain, view, time, isStill);

    return constellations.flatMap(({ stars }) =>
      stars
        .filter(({ placed }) => placed.alpha > 0.05)
        .map(({ star, placed }) => ({
          key: String(star.item.number),
          x: placed.x,
          y: placed.y,
          radius: placed.radius,
        })),
    );
  }

  private place(star: ChartStar, frame: ChartFrame): PlacedStar {
    const position = frame.isStill ? star : starPosition(star, frame.time);
    const [x, y] = frame.camera.toScreen(position.x, position.y, frame.view);
    const grow = starGrowth(star, frame.sinceShown);
    return {
      x,
      y,
      radius: star.magnitude * Math.max(frame.camera.current.scale, MIN_STAR_SCALE) * grow,
      color: this.palette.channels(BUCKET_LOOK[star.bucket].color),
      alpha: grow * (passes(star, frame.filter) ? 1 : DIMMED),
      pulse: frame.isStill ? 1 : starPulse(star, frame.time),
      isUrgent: star.isUrgent && !frame.isStill,
      isSelected: star.item.number === frame.selected,
      ringPhase: (frame.time * RING_PERIOD + star.pulsePhase) % 1,
      mark: frame.marks.get(star.item.number) ?? null,
      markPhase: frame.isStill
        ? STILL_MARK_PHASE
        : (frame.time * MARK_PERIOD + star.pulsePhase) % 1,
    };
  }

  /** Two blurs and the sharp layer on top: a tight halo, a wide one, crisp cores. */
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
      ['blur(6px)', 0.95],
      ['blur(22px)', 0.34],
      ['none', 1],
    ] as const) {
      ctx.filter = blur;
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.glow, 0, 0, view.width, view.height);
    }
    ctx.restore();
  }
}
