import { InjectionToken } from '@angular/core';
import { CoreView } from '../instrument/core-view';
import { resolveColour } from '../instrument/palette';
import {
  PlacedTrail,
  STAR_TINTS,
  StarTint,
  StarTrail,
  TRAIL_TURN_PER_S,
  liftFaint,
  placeTrails,
} from './star-trails';

/** Where the sky is centred and how big it is. */
export interface SkyView {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly poleX: number;
  readonly poleY: number;
  readonly coreRadius: number;
}

interface SkyInks {
  readonly glow: string;
  readonly mid: string;
  readonly deep: string;
  readonly vignette: string;
  readonly stars: Readonly<Record<StarTint, string>>;
}

/** The trail image can't be larger than this on a side. */
const MAX_TRAIL_IMAGE = 2048;
/** The trail image is a little larger than the window, so its corners never show as it turns. */
const TRAIL_MARGIN = 1.12;
const TRAIL_STEPS = 12;
const GRAIN_SIZE = 128;
const GRAIN_ALPHA = 0.045;
const GRAIN_DRIFT_PX = 64;
const GLOW_REACH = 0.9;
const VIGNETTE_FROM = 0.3;
const VIGNETTE_TO = 0.78;

/** The sky with no core measured yet: centred, as a core would be. */
export function skyViewOf(
  view: CoreView | null,
  viewport: { width: number; height: number; pixelRatio: number },
): SkyView {
  return {
    width: viewport.width,
    height: viewport.height,
    pixelRatio: Math.min(viewport.pixelRatio || 1, 2),
    poleX: view?.poleX ?? viewport.width / 2,
    poleY: view?.poleY ?? viewport.height * 0.4,
    coreRadius: view?.radius ?? 120,
  };
}

/** What the sky backdrop draws with, behind a token so a test's DOM, which
 *  has no canvas, can stand in something quiet. */
export interface SkyCanvas {
  canDraw(): boolean;
  setTrails(trails: readonly StarTrail[]): void;
  setView(view: SkyView): void;
  paint(time: number, isStill: boolean): void;
  dispose(): void;
}

export const SKY_CANVAS = new InjectionToken<(host: HTMLElement) => SkyCanvas>('SKY_CANVAS', {
  providedIn: 'root',
  factory: () => (host) => new SkyPainter(host),
});

/** Paints the night behind Home: a green glow round the pole, the star
 *  trails turning about it with their heads twinkling, a vignette and grain. */
export class SkyPainter implements SkyCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly inks: SkyInks;
  private readonly trailImage: HTMLCanvasElement;
  private readonly grain: HTMLCanvasElement;
  private view: SkyView | null = null;
  private trails: readonly StarTrail[] = [];
  private placed: PlacedTrail[] = [];
  private trailSpan = 0;
  private trailKey = '';

  constructor(host: HTMLElement) {
    const document = host.ownerDocument;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    host.append(this.canvas);
    this.context = this.canvas.getContext('2d');
    this.inks = readInks(host);
    this.trailImage = document.createElement('canvas');
    this.grain = grainTile(document);
  }

  canDraw(): boolean {
    return this.context !== null;
  }

  setTrails(trails: readonly StarTrail[]): void {
    this.trails = trails;
    this.trailKey = '';
  }

  setView(view: SkyView): void {
    if (
      view.width !== this.view?.width ||
      view.height !== this.view?.height ||
      view.pixelRatio !== this.view?.pixelRatio
    ) {
      this.canvas.width = Math.floor(view.width * view.pixelRatio);
      this.canvas.height = Math.floor(view.height * view.pixelRatio);
    }
    this.view = view;
  }

  /** `time` is scene seconds, which stop while motion is off. */
  paint(time: number, isStill: boolean): void {
    const { context, view } = this;
    if (!context || !view) return;
    this.repaintTrails(view);
    context.setTransform(view.pixelRatio, 0, 0, view.pixelRatio, 0, 0);
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
    this.paintNight(context, view);
    this.paintTrails(context, view, time, isStill);
    this.paintVignette(context, view);
    this.paintGrain(context, view, time, isStill);
  }

  dispose(): void {
    this.canvas.remove();
  }

  private paintNight(context: CanvasRenderingContext2D, view: SkyView): void {
    const span = Math.max(view.width, view.height) * GLOW_REACH;
    const glow = context.createRadialGradient(
      view.poleX,
      view.poleY,
      0,
      view.poleX,
      view.poleY,
      span,
    );
    glow.addColorStop(0, this.inks.glow);
    glow.addColorStop(0.42, this.inks.mid);
    glow.addColorStop(1, this.inks.deep);
    context.fillStyle = glow;
    context.fillRect(0, 0, view.width, view.height);
  }

  private paintTrails(
    context: CanvasRenderingContext2D,
    view: SkyView,
    time: number,
    isStill: boolean,
  ): void {
    if (!this.placed.length) return;
    context.save();
    context.translate(view.poleX, view.poleY);
    context.rotate(-time * TRAIL_TURN_PER_S);
    context.globalCompositeOperation = 'lighter';
    context.drawImage(
      this.trailImage,
      -this.trailSpan,
      -this.trailSpan,
      this.trailSpan * 2,
      this.trailSpan * 2,
    );
    for (const trail of this.placed) {
      const twinkle = isStill ? 1 : 0.62 + 0.38 * Math.sin(time * trail.rate + trail.phase);
      context.globalAlpha = Math.min(1, trail.alpha * trail.fade * 1.7 * twinkle);
      context.fillStyle = this.inks.stars[trail.tint];
      context.beginPath();
      context.arc(
        Math.cos(trail.head) * trail.radius,
        Math.sin(trail.head) * trail.radius,
        0.4 + trail.size * 0.7,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.restore();
  }

  /** The arcs are drawn once into an image, and again only when the window
   *  outgrows it, the core changes size or the stars change. */
  private repaintTrails(view: SkyView): void {
    const reach =
      Math.hypot(
        Math.max(view.poleX, view.width - view.poleX),
        Math.max(view.poleY, view.height - view.poleY),
      ) + 40;
    const key = `${this.trails.length}|${Math.round(view.coreRadius)}|${Math.ceil(reach / 100)}|${view.pixelRatio}`;
    if (key === this.trailKey) return;
    this.trailKey = key;
    this.trailSpan = Math.ceil(reach * TRAIL_MARGIN);
    this.placed = placeTrails(this.trails, this.trailSpan, view.coreRadius);
    const size = Math.min(MAX_TRAIL_IMAGE, Math.ceil(this.trailSpan * 2 * view.pixelRatio));
    const scale = size / (this.trailSpan * 2);
    this.trailImage.width = this.trailImage.height = size;
    const image = this.trailImage.getContext('2d');
    if (!image) return;
    image.clearRect(0, 0, size, size);
    image.save();
    image.translate(size / 2, size / 2);
    image.globalCompositeOperation = 'lighter';
    image.lineCap = 'round';
    for (const trail of this.placed) this.arc(image, trail, scale);
    image.restore();
  }

  /** Brightest at the head, the leading end as the sky turns. */
  private arc(image: CanvasRenderingContext2D, trail: PlacedTrail, scale: number): void {
    image.strokeStyle = this.inks.stars[trail.tint];
    image.lineWidth = trail.width * scale;
    for (let step = 0; step < TRAIL_STEPS; step++) {
      image.globalAlpha = liftFaint(
        trail.alpha * trail.fade * Math.pow((TRAIL_STEPS - step) / TRAIL_STEPS, 1.7),
      );
      image.beginPath();
      image.arc(
        0,
        0,
        trail.radius * scale,
        trail.head + (trail.length * step) / TRAIL_STEPS,
        trail.head + (trail.length * (step + 1)) / TRAIL_STEPS,
      );
      image.stroke();
    }
  }

  private paintVignette(context: CanvasRenderingContext2D, view: SkyView): void {
    const midX = view.width / 2;
    const midY = view.height / 2;
    const shade = context.createRadialGradient(
      midX,
      midY,
      Math.min(view.width, view.height) * VIGNETTE_FROM,
      midX,
      midY,
      Math.max(view.width, view.height) * VIGNETTE_TO,
    );
    shade.addColorStop(0, 'transparent');
    shade.addColorStop(1, this.inks.vignette);
    context.fillStyle = shade;
    context.fillRect(0, 0, view.width, view.height);
  }

  private paintGrain(
    context: CanvasRenderingContext2D,
    view: SkyView,
    time: number,
    isStill: boolean,
  ): void {
    const pattern = context.createPattern(this.grain, 'repeat');
    if (!pattern) return;
    const offsetX = isStill ? 0 : Math.round(Math.sin(time * 37) * GRAIN_DRIFT_PX);
    const offsetY = isStill ? 0 : Math.round(Math.cos(time * 41) * GRAIN_DRIFT_PX);
    context.save();
    context.globalCompositeOperation = 'overlay';
    context.globalAlpha = GRAIN_ALPHA;
    context.translate(offsetX, offsetY);
    context.fillStyle = pattern;
    context.fillRect(
      -offsetX - GRAIN_SIZE,
      -offsetY - GRAIN_SIZE,
      view.width + GRAIN_SIZE * 2,
      view.height + GRAIN_SIZE * 2,
    );
    context.restore();
  }
}

function readInks(host: HTMLElement): SkyInks {
  const ink = (token: string): string => resolveColour(host, `var(${token})`);
  const stars = Object.fromEntries(STAR_TINTS.map((tint) => [tint, ink(tint)])) as Record<
    StarTint,
    string
  >;
  return {
    glow: ink('--sky-glow'),
    mid: ink('--sky-mid'),
    deep: ink('--sky-deep'),
    vignette: ink('--sky-vignette'),
    stars,
  };
}

/** A tile of grey noise, laid over the sky in overlay mode as film grain. */
function grainTile(document: Document): HTMLCanvasElement {
  const tile = document.createElement('canvas');
  tile.width = tile.height = GRAIN_SIZE;
  const context = tile.getContext('2d');
  if (!context) return tile;
  const image = context.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  for (let i = 0; i < image.data.length; i += 4) {
    const grey = 118 + Math.random() * 140;
    image.data.fill(grey, i, i + 3);
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return tile;
}
