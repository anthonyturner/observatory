import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  ErrorHandler,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { BinaryLayer } from '../engine/binary-layer';
import { CollisionLayer, SkyPair } from '../engine/collision-layer';
import { SkyEngine } from '../engine/sky-engine';
import { SkyLayout, layoutQueue } from '../engine/sky-layout';
import { SkyItem, SkyStar } from '../engine/sky-model';
import { ThreadLayer } from '../engine/thread-layer';
import { LogSkyLayout, LogStar } from '../../../core/logs/log-layout';
import { twinStars } from '../../../core/logs/log-trace';
import { feedLogs, logStarOf } from '../sky-logs';

/** What the chrome takes off each edge, so Fit frames the sky between it. */
export interface SkyInsets {
  readonly top: number;
  readonly bottom: number;
  readonly side: number;
}

const DEFAULT_INSETS: SkyInsets = { top: 140, bottom: 70, side: 0 };
const TYPING_OR_DIALOG = 'input, textarea, select, [contenteditable], [role="dialog"]';
const PANS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * pr-starmap's star map: the review queue as constellations, drawn in 3D with
 * Three.js when the browser can, in Canvas 2D when it cannot. A click on a
 * star picks its pull request.
 */
@Component({
  selector: 'app-starmap-sky',
  template: '<canvas #sky aria-label="Star map of the review queue"></canvas>',
  styleUrl: './starmap-sky.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
})
export class StarmapSky {
  /** Which sky: the review queue, or the Log Sky. */
  readonly chart = input<'prs' | 'logs'>('prs');
  readonly items = input.required<readonly SkyItem[]>();
  readonly logLayout = input<LogSkyLayout | null>(null);
  /** The log star whose card is open, and the fault whose threads are drawn. */
  readonly selectedLog = input<LogStar | null>(null);
  readonly traced = input<LogStar | null>(null);
  /** The legend's filter: a bucket, `quick`, or none. */
  readonly filter = input<string | null>(null);
  readonly selected = input<number | null>(null);
  readonly pairs = input<readonly SkyPair[]>([]);
  readonly showCollisions = input(true);
  /** 0 clear to 1 full. */
  readonly fog = input(0);
  readonly hidden = input(false);
  readonly insets = input<SkyInsets>(DEFAULT_INSETS);
  readonly picked = output<number | null>();
  /** A log star was clicked, or empty sky (null), on the Log Sky. */
  readonly pickedLog = output<LogStar | null>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('sky');
  private readonly document = inject(DOCUMENT);
  private readonly motion = inject(MotionPreference);
  private readonly errors = inject(ErrorHandler);
  private readonly collisions = new CollisionLayer();
  private readonly binaries = new BinaryLayer((star) => star.item?.issues ?? []);
  private readonly threads = new ThreadLayer();
  private engine: SkyEngine | null = null;
  private isFramed = false;
  /** The skies already framed once, so a data refresh keeps the viewer's camera. */
  private readonly framed = new Set<string>();

  constructor() {
    afterNextRender(() => this.start());
    inject(DestroyRef).onDestroy(() => this.engine?.dispose());
    effect(() => {
      const chart = this.chart();
      const items = this.items();
      const logs = this.logLayout();
      untracked(() => this.layOut(chart, items, logs));
    });
    effect(() => {
      const filter = this.filter();
      const engine = this.engine;
      if (!engine) return;
      engine.filter = filterFor(filter);
      untracked(() => engine.fit());
    });
    effect(() => {
      this.selected();
      this.selectedLog();
      this.traced();
      untracked(() => this.select());
    });
    effect(() => {
      this.collisions.pairs = this.pairs();
      this.collisions.showCollisions = this.showCollisions();
      const engine = this.engine;
      if (!engine) return;
      engine.fog = this.fog();
      engine.kick();
    });
    effect(() => {
      const hidden = this.hidden();
      this.engine?.setHidden(hidden);
    });
    effect(() => {
      this.motion.isStill();
      this.engine?.kick();
    });
  }

  zoomIn(): void {
    this.engine?.zoomIn();
  }

  zoomOut(): void {
    this.engine?.zoomOut();
  }

  fit(): void {
    this.engine?.fit();
  }

  pan(dx: number, dy: number): void {
    this.engine?.pan(dx, dy);
  }

  /** Flies to a pull request's star, as a list row or a changes row does. */
  goTo(number: number): void {
    const star = this.engine?.skyStars.find((s) => s.item?.pr === number);
    if (star) this.engine?.goTo(star);
  }

  /** Flies to a fault's star, as a log list row does. */
  goToLog(logStar: LogStar): void {
    const star = this.engine?.skyStars.find((s) => s.data === logStar);
    if (star) this.engine?.goTo(star);
  }

  /** + and − zoom, the arrows pan; keys typed into a field or a dialog are theirs. */
  protected onKey(event: KeyboardEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest(TYPING_OR_DIALOG)) return;
    if (this.hidden()) return;
    const pan = PANS[event.key];
    if (pan) {
      event.preventDefault();
      this.pan(pan[0], pan[1]);
    } else if (event.key === '+' || event.key === '=') {
      this.zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      this.zoomOut();
    }
  }

  private start(): void {
    const canvas = this.canvas().nativeElement;
    try {
      this.engine = new SkyEngine({
        document: this.document,
        canvas,
        frozen: () => this.motion.isStill(),
        insets: () => this.insets(),
        picked: (star: SkyStar | null) =>
          this.chart() === 'logs'
            ? this.pickedLog.emit(logStarOf(star))
            : this.picked.emit(star?.item?.pr ?? null),
        loadWebGL: async (camera, onLost) => {
          const { WebGLSkyRenderer } = await import('../engine/webgl-sky');
          return new WebGLSkyRenderer(
            this.document,
            canvas,
            camera,
            () => ({
              width: this.document.defaultView?.innerWidth ?? 0,
              height: this.document.defaultView?.innerHeight ?? 0,
            }),
            onLost,
          );
        },
        failed: (error) => this.errors.handleError(error),
      });
    } catch (error) {
      // A browser without a 2D canvas (a test's) draws nothing.
      this.errors.handleError(error);
      return;
    }
    this.engine.layers = [this.collisions, this.binaries, this.threads];
    this.engine.filter = filterFor(this.filter());
    this.engine.fog = this.fog();
    this.engine.setHidden(this.hidden());
    this.layOut(this.chart(), this.items(), this.logLayout());
  }

  /** Lays out the sky on screen. Within one sky stars glide to their new places;
   *  switching skies draws the new one fresh and frames it. */
  private layOut(
    chart: 'prs' | 'logs',
    items: readonly SkyItem[],
    logs: LogSkyLayout | null,
  ): void {
    const engine = this.engine;
    if (!engine) return;
    const switched = engine.chart !== chart;
    engine.chart = chart;
    if (chart === 'logs') {
      engine.setSky((sky: SkyLayout) => logs && feedLogs(logs, sky));
    } else {
      engine.setSky((sky: SkyLayout) => layoutQueue(items, sky), {
        carry: this.isFramed && !switched,
      });
    }
    this.select();
    const count = chart === 'logs' ? (logs?.stars.length ?? 0) : items.length;
    if (count && (switched || !this.framed.has(chart))) {
      engine.fit();
      this.framed.add(chart);
      this.isFramed = true;
    }
  }

  /** Rings the selected star, and traces the fault in focus to its twins. */
  private select(): void {
    const engine = this.engine;
    if (!engine) return;
    const stars = engine.skyStars;
    const selectedLog = this.selectedLog();
    engine.selected =
      engine.chart === 'logs'
        ? (stars.find((s) => s.data === selectedLog && selectedLog !== null) ?? null)
        : (stars.find((s) => s.item?.pr === this.selected()) ?? null);
    const traced = this.traced();
    const tracedStar = traced ? stars.find((s) => s.data === traced) : undefined;
    const twins = new Set(twinStars(traced, this.logLayout()?.stars ?? []));
    this.threads.trace = tracedStar
      ? { traced: tracedStar, twins: stars.filter((s) => twins.has(s.data as LogStar)) }
      : null;
    engine.kick();
  }
}

/** A legend filter as a test on a star: a bucket, or the quick wins across them. */
export function filterFor(filter: string | null): ((star: SkyStar) => boolean) | null {
  if (!filter) return null;
  if (filter === 'quick') return (star) => !!star.quick;
  return (star) => star.key === filter;
}
