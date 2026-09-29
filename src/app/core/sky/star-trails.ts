import { seededRandom } from '../instrument/seeded-random';

// A long exposure: each star is a short arc about the pole, drawn once into an
// image that turns once every twenty minutes, calm and only just noticeable,
// unless Home's Spin lever sets another pace. A
// still sky keeps the arcs, because the arcs are the drawing, not the motion.
// The pole is where the core sits before any scrolling, so the trails stay put
// as the page scrolls and the core rises past them. Near the core they thin
// out, so its rings read. Ported from pr-starmap's Home.

const TRAIL_COUNT = 600;
const TRAIL_SEED = 8675309;
/** One turn every twenty minutes, in radians a second. */
export const TRAIL_TURN = (Math.PI * 2) / (20 * 60);
/** Capped, so a sky back from a pause, or from holding still, does not whirl round to catch up. */
const MAX_TURN_STEP_S = 0.25;
const DEG = Math.PI / 180;
const TINTS = ['#ffffff', '#dce8ff', '#bcd2ff', '#fff0d6', '#ffd9b8'];
/** One star in this many is a bright one. */
const BRIGHT_SHARE = 0.06;
/** How far past the window's far corner the arcs reach, so turning never shows an edge. */
const REACH_MARGIN = 1.12;
const MAX_IMAGE_PX = 2048;
/** No arc closer to the pole than this. */
const INNER_PX = 26;
/** An arc is drawn in steps, brightest at its head. */
const ARC_STEPS = 12;
/** Arcs thin out inside this many core radii, so the rings read. */
const CLEARING_RADII = 1.5;

/** One star's arc, in the image's own terms; `radiusPx` is set when it is painted. */
export interface TrailStar {
  /** 0 to 1: how far out from the pole, before the square root that spreads them evenly. */
  readonly u: number;
  /** The angle of its bright head, in radians. */
  readonly head: number;
  /** How long its arc is, in radians. */
  readonly length: number;
  readonly alpha: number;
  readonly widthPx: number;
  readonly sizePx: number;
  readonly tint: string;
  /** Its twinkle: where it starts and how fast it goes. */
  readonly phase: number;
  readonly rate: number;
}

/** The same 600 stars on every load. Kept faint: only the core may glow. */
export function trailStars(seed = TRAIL_SEED): TrailStar[] {
  const random = seededRandom(seed);
  return Array.from({ length: TRAIL_COUNT }, () => {
    const bright = random() < BRIGHT_SHARE;
    return {
      u: random(),
      head: random() * Math.PI * 2,
      length: (16 + random() * 22) * DEG,
      alpha: bright ? 0.42 + random() * 0.2 : 0.07 + Math.pow(random(), 2.2) * 0.38,
      widthPx: bright ? 1.1 + random() * 0.5 : 0.55 + random() * 0.5,
      sizePx: bright ? 0.8 + random() * 0.4 : 0.3 + random() * 0.6,
      tint: TINTS[Math.floor(random() * TINTS.length)],
      phase: random() * Math.PI * 2,
      rate: 0.3 + random() * 1.6,
    };
  });
}

/** How far from the pole the arcs must reach to fill the window from any corner. */
export function trailReach(width: number, height: number, poleX: number, poleY: number): number {
  return Math.hypot(Math.max(poleX, width - poleX), Math.max(poleY, height - poleY)) + 40;
}

/** The sky's turn after `stepS` more seconds at `speed` times the natural pace. */
export function advanceTurn(turn: number, stepS: number, speed: number): number {
  return turn + Math.min(Math.max(stepS, 0), MAX_TURN_STEP_S) * TRAIL_TURN * speed;
}

/** A canvas adds light in screen space, which a faint arc needs lifted to show. */
const lift = (alpha: number): number =>
  Math.min(1, 1.055 * Math.pow(Math.max(0, alpha), 1 / 2.4) - 0.055);

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

interface PaintedStar {
  readonly star: TrailStar;
  readonly radiusPx: number;
  readonly fade: number;
}

/** The arcs, painted once into an image and turned about the pole each frame. */
export class StarTrails {
  private readonly stars = trailStars();
  private image: HTMLCanvasElement | null = null;
  private painted: readonly PaintedStar[] = [];
  private spanPx = 0;
  private paintedFor = '';
  /** Summed frame by frame rather than read off the clock, so a new speed carries on from here. */
  private turn = 0;
  private lastTime: number | null = null;

  constructor(private readonly document: Document) {}

  /** Draws the arcs, turned `speed` times the natural pace, and their twinkling heads. */
  draw(
    context: CanvasRenderingContext2D,
    sky: {
      width: number;
      height: number;
      pixelRatio: number;
      poleX: number;
      poleY: number;
      coreRadius: number;
    },
    time: number,
    speed: number,
  ): void {
    this.turn = advanceTurn(this.turn, time - (this.lastTime ?? time), speed);
    this.lastTime = time;
    const reach = trailReach(sky.width, sky.height, sky.poleX, sky.poleY);
    this.paintIfNeeded(reach, sky.coreRadius, sky.pixelRatio);
    if (!this.image) return;
    context.save();
    context.translate(sky.poleX, sky.poleY);
    context.rotate(-this.turn);
    context.globalCompositeOperation = 'lighter';
    const span = this.spanPx;
    context.drawImage(this.image, -span, -span, span * 2, span * 2);
    for (const { star, radiusPx, fade } of this.painted) {
      const twinkle = 0.62 + 0.38 * Math.sin(time * star.rate + star.phase);
      context.globalAlpha = Math.min(1, star.alpha * fade * 1.7 * twinkle);
      context.fillStyle = star.tint;
      context.beginPath();
      context.arc(
        Math.cos(star.head) * radiusPx,
        Math.sin(star.head) * radiusPx,
        0.4 + star.sizePx * 0.7,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.restore();
  }

  /** Repainted only when the window outgrows the arcs, or the core or pixel ratio changes. */
  private paintIfNeeded(reach: number, coreRadius: number, pixelRatio: number): void {
    const key = `${Math.round(coreRadius)}|${pixelRatio}`;
    if (this.image && reach <= this.spanPx && key === this.paintedFor) return;
    this.paintedFor = key;
    this.spanPx = Math.ceil(Math.max(reach, this.spanPx) * REACH_MARGIN);
    const size = Math.min(MAX_IMAGE_PX, Math.ceil(this.spanPx * 2 * pixelRatio));
    const scale = size / (this.spanPx * 2);
    const image = this.image ?? this.document.createElement('canvas');
    image.width = image.height = size;
    const context = image.getContext('2d');
    if (!context) {
      this.image = null;
      return;
    }
    this.image = image;
    const clearing = coreRadius * CLEARING_RADII;
    this.painted = this.stars.map((star) => {
      const radiusPx = INNER_PX + Math.sqrt(star.u) * (this.spanPx - INNER_PX);
      return {
        star,
        radiusPx,
        fade: 0.3 + 0.7 * clamp01((radiusPx - clearing * 0.75) / (clearing * 0.6)),
      };
    });
    context.clearRect(0, 0, size, size);
    context.save();
    context.translate(size / 2, size / 2);
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    for (const { star, radiusPx, fade } of this.painted) {
      context.strokeStyle = star.tint;
      context.lineWidth = star.widthPx * scale;
      // Brightest at the head, the leading end as the sky turns.
      for (let step = 0; step < ARC_STEPS; step++) {
        context.globalAlpha = lift(
          star.alpha * fade * Math.pow((ARC_STEPS - step) / ARC_STEPS, 1.7),
        );
        context.beginPath();
        context.arc(
          0,
          0,
          radiusPx * scale,
          star.head + (star.length * step) / ARC_STEPS,
          star.head + (star.length * (step + 1)) / ARC_STEPS,
        );
        context.stroke();
      }
    }
    context.restore();
  }
}
