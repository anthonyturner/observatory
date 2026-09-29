import { InjectionToken } from '@angular/core';
import { CoreView } from '../instrument/core-view';
import { resolveColour } from '../instrument/palette';
import { Comet, CometFlight, flightAt } from './comets';
import { Flare, flareAt, flaresFrom } from './flares';
import { StarTrails } from './star-trails';

/** Where the sky is centred and how big it is. */
export interface SkyView {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly poleX: number;
  readonly poleY: number;
  /** The core's radius, which the star trails thin out near. */
  readonly coreRadius: number;
}

interface SkyInks {
  readonly glow: string;
  readonly mid: string;
  readonly deep: string;
  readonly vignette: string;
  /** The green of a flare: work got done. */
  readonly progress: string;
}

const GRAIN_SIZE = 128;
const GRAIN_ALPHA = 0.045;
const GRAIN_DRIFT_PX = 64;
const GLOW_REACH = 0.9;
const VIGNETTE_FROM = 0.3;
const VIGNETTE_TO = 0.78;
const FLARE_WIDTH_PX = 2.2;
/** A flare is dropped once it has surely arrived. */
const FLARE_LIFE_S = 3;
/** A comet's head is a little wider than its tail. */
const HEAD_GROWTH = 1.3;
/** The core's size before one is measured, for where the trails thin out. */
const DEFAULT_CORE_RADIUS = 120;

/** Where the sky glows from: the core, or where a core would be before one is measured. */
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
    coreRadius: view?.radius ?? DEFAULT_CORE_RADIUS,
  };
}

/** What the sky backdrop draws with, behind a token so a test's DOM, which
 *  has no canvas, can stand in something quiet. */
export interface SkyCanvas {
  canDraw(): boolean;
  setComets(comets: readonly Comet[]): void;
  /** Sends `count` green comets into the core, from the next frame. */
  flare(count: number): void;
  setView(view: SkyView): void;
  /** How fast the star trails turn, as a multiple of their natural pace. */
  setTrailSpeed(speed: number): void;
  paint(time: number, isStill: boolean): void;
  dispose(): void;
}

export const SKY_CANVAS = new InjectionToken<(host: HTMLElement) => SkyCanvas>('SKY_CANVAS', {
  providedIn: 'root',
  factory: () => (host) => new SkyPainter(host),
});

/** Paints the night behind Home: a green glow round the core, star trails
 *  turning about it, a rain of comets in their projects' colours, a vignette
 *  and grain. */
export class SkyPainter implements SkyCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly inks: SkyInks;
  private readonly grain: HTMLCanvasElement;
  private readonly colours = new Map<string, string>();
  private readonly host: HTMLElement;
  private readonly trails: StarTrails;
  private view: SkyView | null = null;
  private comets: readonly Comet[] = [];
  private flares: Flare[] = [];
  private flaresWaiting = 0;
  private trailSpeed = 1;

  constructor(host: HTMLElement) {
    const document = host.ownerDocument;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    host.append(this.canvas);
    this.context = this.canvas.getContext('2d');
    this.inks = readInks(host);
    this.host = host;
    this.grain = grainTile(document);
    this.trails = new StarTrails(document);
  }

  canDraw(): boolean {
    return this.context !== null;
  }

  setComets(comets: readonly Comet[]): void {
    this.comets = comets;
  }

  flare(count: number): void {
    this.flaresWaiting += count;
  }

  setTrailSpeed(speed: number): void {
    this.trailSpeed = speed;
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
    context.setTransform(view.pixelRatio, 0, 0, view.pixelRatio, 0, 0);
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
    this.paintNight(context, view);
    this.trails.draw(context, view, time, this.trailSpeed);
    this.paintComets(context, view, time);
    this.paintFlares(context, view, time);
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

  private paintComets(context: CanvasRenderingContext2D, view: SkyView, time: number): void {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    for (const comet of this.comets) {
      const flight = flightAt(comet, time, view);
      if (flight) this.paintComet(context, comet, flight);
    }
    context.restore();
  }

  /** A streak from its bright head back to nothing, and a small round head. */
  /** Flares wait for a frame to learn the scene time, then fly until they arrive. */
  private paintFlares(context: CanvasRenderingContext2D, view: SkyView, time: number): void {
    if (this.flaresWaiting > 0) {
      this.flares = [...this.flares, ...flaresFrom(this.flaresWaiting, time, Math.random)];
      this.flaresWaiting = 0;
    }
    if (!this.flares.length) return;
    this.flares = this.flares.filter((flare) => time <= flare.startS + FLARE_LIFE_S);
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    for (const flare of this.flares) {
      const flight = flareAt(flare, time, view);
      if (flight)
        this.paintStreak(context, { colour: this.inks.progress, widthPx: FLARE_WIDTH_PX }, flight);
    }
    context.restore();
  }

  private paintComet(context: CanvasRenderingContext2D, comet: Comet, flight: CometFlight): void {
    this.paintStreak(
      context,
      { colour: this.colourOf(comet.colour), widthPx: comet.widthPx },
      flight,
    );
  }

  private paintStreak(
    context: CanvasRenderingContext2D,
    streak: { colour: string; widthPx: number },
    flight: CometFlight,
  ): void {
    const { colour } = streak;
    const tail = context.createLinearGradient(
      flight.headX,
      flight.headY,
      flight.tailX,
      flight.tailY,
    );
    tail.addColorStop(0, colour);
    tail.addColorStop(1, 'transparent');
    context.globalAlpha = flight.alpha;
    context.strokeStyle = tail;
    context.lineWidth = streak.widthPx;
    context.beginPath();
    context.moveTo(flight.headX, flight.headY);
    context.lineTo(flight.tailX, flight.tailY);
    context.stroke();
    context.fillStyle = colour;
    context.beginPath();
    context.arc(flight.headX, flight.headY, streak.widthPx * HEAD_GROWTH, 0, Math.PI * 2);
    context.fill();
  }

  /** Severity colours are CSS variables, which a canvas cannot read; resolved once each. */
  private colourOf(expression: string): string {
    const known = this.colours.get(expression);
    if (known) return known;
    const resolved = resolveColour(this.host, expression);
    this.colours.set(expression, resolved);
    return resolved;
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
  return {
    glow: ink('--sky-glow'),
    mid: ink('--sky-mid'),
    deep: ink('--sky-deep'),
    vignette: ink('--sky-vignette'),
    progress: ink('--ok'),
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
