import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  ErrorHandler,
  afterNextRender,
  effect,
  inject,
  input,
} from '@angular/core';
import { CoreGeometry } from '../../../core/instrument/core-geometry';
import { CoreHand } from '../../../core/instrument/core-hand';
import { CORE_MOOD, CORE_RENDERER, CORE_STATE } from '../../../core/instrument/core-tokens';
import { CoreView, coreViewOf } from '../../../core/instrument/core-view';
import { FrameLoop, FrameScheduler } from '../../../core/instrument/frame-loop';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { LitProject } from '../../../core/projects/lit-project';
import { PROJECTS, PROJECTS_STATE } from '../../../core/projects/projects-source';
import { BeadLabel } from './bead-label';

/** The backdrop's budget: speech models will share the graphics card with it. */
const FPS_SHOWN = 30;
/** Once the core has scrolled away there is little left to see. */
const FPS_AWAY = 15;
/** The ball follows the hand, so it draws as smoothly as the display allows. */
const FPS_TOUCHED = 60;

/** Draws the core behind the HUD, at the anchor's place, following it as the page scrolls. */
@Component({
  selector: 'app-core-canvas',
  imports: [BeadLabel],
  template: '<app-bead-label />',
  styleUrl: './core-canvas.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class CoreCanvas {
  /** The box the core is centred in and sized to. */
  readonly anchor = input.required<HTMLElement>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly projects = inject(PROJECTS);
  private readonly state = inject(CORE_STATE);
  private readonly mood = inject(CORE_MOOD);
  private readonly projectsState = inject(PROJECTS_STATE);
  /** When the latest projects report arrived, in real seconds, and which one it was. */
  private refreshWall: number | null = null;
  private lastReport: string | null = null;
  private readonly motion = inject(MotionPreference);
  private readonly errors = inject(ErrorHandler);
  private readonly hand = inject(CoreHand);
  private readonly lit = inject(LitProject);
  private readonly geometry = inject(CoreGeometry);
  private readonly renderer = inject(CORE_RENDERER)();
  private readonly teardown: (() => void)[] = [];
  private loop: FrameLoop | null = null;
  private view: CoreView | null = null;
  private stateSince = 0;

  constructor() {
    effect(() => {
      this.renderer.setProjects(this.projects());
      this.loop?.kick();
    });
    effect(() => {
      this.state();
      this.stateSince = performance.now() / 1000;
      this.loop?.kick();
    });
    effect(() => {
      this.motion.isStill();
      this.hand.touched();
      this.mood();
      this.lit.key();
      this.loop?.kick();
    });
    effect(() => {
      const state = this.projectsState();
      if (state.status !== 'ready' || state.report.generatedAt === this.lastReport) return;
      this.lastReport = state.report.generatedAt;
      this.refreshWall = performance.now() / 1000;
      this.loop?.kick();
    });
    afterNextRender(() => this.start());
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  private start(): void {
    this.renderer.mount(this.host.nativeElement, () => this.loop?.kick());
    if (!this.renderer.canDraw()) return;
    this.loop = new FrameLoop({
      scheduler: this.scheduler(),
      draw: (time, wall) => this.draw(time, wall),
      framesPerSecond: () => this.framesPerSecond(),
      isStill: () => this.motion.isStill(),
      onError: (error) => this.errors.handleError(error),
    });
    this.measure();
    this.listen();
  }

  private scheduler(): FrameScheduler {
    const window = this.document.defaultView;
    return {
      request: (callback) => window?.requestAnimationFrame(callback),
      isHidden: () => this.document.hidden,
      nowMs: () => performance.now(),
    };
  }

  private framesPerSecond(): number {
    if (this.view?.isAway) return FPS_AWAY;
    return this.hand.state.isBusy ? FPS_TOUCHED : FPS_SHOWN;
  }

  private draw(time: number, wall: number): void {
    this.hand.state.advance(wall);
    this.renderer.frame({
      time,
      wall,
      state: this.state(),
      stateAge: wall - this.stateSince,
      isStill: this.motion.isStill(),
      hand: this.hand.state.pose,
      litKey: this.lit.key(),
      mood: this.mood(),
      sinceRefresh: this.refreshWall === null ? null : wall - this.refreshWall,
    });
  }

  /** Taken on scroll and resize and cached, never per frame: measuring the
   *  page every frame makes the browser lay it out again. */
  private measure(): void {
    const window = this.document.defaultView;
    if (!window) return;
    const box = this.anchor().getBoundingClientRect();
    this.view = coreViewOf(box, {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollY: window.scrollY,
      pixelRatio: window.devicePixelRatio,
    });
    this.renderer.setView(this.view);
    this.geometry.place(this.view);
    this.loop?.kick();
  }

  private listen(): void {
    const window = this.document.defaultView;
    const measure = (): void => this.measure();
    const wake = (): void => this.loop?.kick();
    window?.addEventListener('resize', measure);
    window?.addEventListener('scroll', measure, { passive: true });
    this.document.addEventListener('visibilitychange', wake);
    const resizes = new ResizeObserver(measure);
    resizes.observe(this.anchor());
    this.teardown.push(
      () => window?.removeEventListener('resize', measure),
      () => window?.removeEventListener('scroll', measure),
      () => this.document.removeEventListener('visibilitychange', wake),
      () => resizes.disconnect(),
    );
  }

  private stop(): void {
    this.loop?.stop();
    this.teardown.forEach((undo) => undo());
    this.renderer.dispose();
  }
}
