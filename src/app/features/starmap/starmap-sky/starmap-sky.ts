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

/** What the chrome takes off each edge, so Fit frames the sky between it. */
export interface SkyInsets {
  readonly top: number;
  readonly bottom: number;
  readonly side: number;
}

const DEFAULT_INSETS: SkyInsets = { top: 140, bottom: 70, side: 0 };

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
})
export class StarmapSky {
  readonly items = input.required<readonly SkyItem[]>();
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

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('sky');
  private readonly document = inject(DOCUMENT);
  private readonly motion = inject(MotionPreference);
  private readonly errors = inject(ErrorHandler);
  private readonly collisions = new CollisionLayer();
  private readonly binaries = new BinaryLayer((star) => star.item?.issues ?? []);
  private engine: SkyEngine | null = null;
  private isFramed = false;

  constructor() {
    afterNextRender(() => this.start());
    inject(DestroyRef).onDestroy(() => this.engine?.dispose());
    effect(() => {
      const items = this.items();
      untracked(() => this.layOut(items));
    });
    effect(() => {
      const filter = this.filter();
      const engine = this.engine;
      if (!engine) return;
      engine.filter = filterFor(filter);
      untracked(() => engine.fit());
    });
    effect(() => {
      const number = this.selected();
      const engine = this.engine;
      if (!engine) return;
      engine.selected = engine.skyStars.find((s) => s.item?.pr === number) ?? null;
      engine.kick();
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

  private start(): void {
    const canvas = this.canvas().nativeElement;
    try {
      this.engine = new SkyEngine({
        document: this.document,
        canvas,
        frozen: () => this.motion.isStill(),
        insets: () => this.insets(),
        picked: (star: SkyStar | null) => this.picked.emit(star?.item?.pr ?? null),
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
    this.engine.layers = [this.collisions, this.binaries];
    this.engine.filter = filterFor(this.filter());
    this.engine.fog = this.fog();
    this.engine.setHidden(this.hidden());
    this.layOut(this.items());
  }

  private layOut(items: readonly SkyItem[]): void {
    const engine = this.engine;
    if (!engine) return;
    engine.setSky((sky: SkyLayout) => layoutQueue(items, sky), { carry: this.isFramed });
    engine.selected = engine.skyStars.find((s) => s.item?.pr === this.selected()) ?? null;
    if (!this.isFramed && items.length) {
      engine.fit();
      this.isFramed = true;
    }
  }
}

/** A legend filter as a test on a star: a bucket, or the quick wins across them. */
function filterFor(filter: string | null): ((star: SkyStar) => boolean) | null {
  if (!filter) return null;
  if (filter === 'quick') return (star) => !!star.quick;
  return (star) => star.key === filter;
}
