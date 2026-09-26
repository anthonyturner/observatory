import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  ErrorHandler,
  afterNextRender,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { CoreGeometry } from '../../../core/instrument/core-geometry';
import { FrameLoop } from '../../../core/instrument/frame-loop';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { ProgressFeed } from '../../../core/projects/progress-feed';
import { PROJECTS } from '../../../core/projects/projects-source';
import { SKY_CANVAS, SkyCanvas, skyViewOf } from '../../../core/sky/sky-painter';
import { cometsFor } from '../../../core/sky/comets';

/** Comets move fast enough to need a steady rate, but no more than the core's. */
const SKY_FPS = 30;

/** The night behind every page: fixed, decorative, and never takes a pointer.
 *  One comet per open issue falls through it, in its project's colour. */
@Component({
  selector: 'app-sky-backdrop',
  template: '',
  styleUrl: './sky-backdrop.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class SkyBackdrop {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly geometry = inject(CoreGeometry);
  private readonly motion = inject(MotionPreference);
  private readonly errors = inject(ErrorHandler);
  private readonly projects = inject(PROJECTS);
  private readonly progress = inject(ProgressFeed);
  private flaredFor = 0;
  /** Empty until the projects are read: no comets, rather than a made-up count. */
  private readonly comets = computed(() => cometsFor(this.projects()));
  private readonly makeCanvas = inject(SKY_CANVAS);
  private painter: SkyCanvas | null = null;
  private loop: FrameLoop | null = null;

  constructor() {
    afterNextRender(() => this.start());
    effect(() => {
      // Read before the painter exists too, or the effect never learns to rerun.
      const comets = this.comets();
      this.painter?.setComets(comets);
      this.loop?.kick();
    });
    effect(() => {
      this.geometry.view();
      this.motion.isStill();
      this.place();
      this.loop?.kick();
    });
    effect(() => {
      const moment = this.progress.latest();
      if (!moment || moment.id === this.flaredFor) return;
      this.flaredFor = moment.id;
      // With motion off nothing flies; the dots still say what got done.
      if (untracked(this.motion.isStill)) return;
      const done = moment.progress.reduce((sum, p) => sum + p.closedIssues + p.finishedPulls, 0);
      this.painter?.flare(done);
      this.loop?.kick();
    });
    inject(DestroyRef).onDestroy(() => {
      this.loop?.stop();
      this.painter?.dispose();
    });
  }

  private start(): void {
    const painter = this.makeCanvas(this.host.nativeElement);
    if (!painter.canDraw()) {
      painter.dispose();
      return;
    }
    this.painter = painter;
    painter.setComets(this.comets());
    this.place();
    const window = this.document.defaultView;
    this.loop = new FrameLoop({
      scheduler: {
        request: (callback) => window?.requestAnimationFrame(callback),
        isHidden: () => this.document.hidden,
        nowMs: () => performance.now(),
      },
      draw: (time) => painter.paint(time, this.motion.isStill()),
      framesPerSecond: () => SKY_FPS,
      isStill: () => this.motion.isStill(),
      onError: (error) => this.errors.handleError(error),
    });
    this.loop.kick();
  }

  private place(): void {
    const window = this.document.defaultView;
    if (!this.painter || !window) return;
    this.painter.setView(
      skyViewOf(this.geometry.view(), {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
      }),
    );
  }
}
