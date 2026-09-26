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
} from '@angular/core';
import { CoreGeometry } from '../../../core/instrument/core-geometry';
import { FrameLoop } from '../../../core/instrument/frame-loop';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { knownOpenIssues } from '../../../core/projects/open-issues';
import { PROJECTS } from '../../../core/projects/projects-source';
import { SKY_CANVAS, SkyCanvas, skyViewOf } from '../../../core/sky/sky-painter';
import { starTrails } from '../../../core/sky/star-trails';

/** The sky barely moves, so it redraws far less often than the core. */
const SKY_FPS = 12;

/** The night behind every page: fixed, decorative, and never takes a pointer.
 *  One star trail per open issue turns slowly about where the core sits. */
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
  /** Unknown until the projects are read: no stars, rather than a made-up count. */
  private readonly openIssues = computed(() => knownOpenIssues(this.projects()) ?? 0);
  private readonly makeCanvas = inject(SKY_CANVAS);
  private painter: SkyCanvas | null = null;
  private loop: FrameLoop | null = null;

  constructor() {
    afterNextRender(() => this.start());
    effect(() => {
      // Read before the painter exists too, or the effect never learns to rerun.
      const trails = starTrails(this.openIssues());
      this.painter?.setTrails(trails);
      this.loop?.kick();
    });
    effect(() => {
      this.geometry.view();
      this.motion.isStill();
      this.place();
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
    painter.setTrails(starTrails(this.openIssues()));
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
