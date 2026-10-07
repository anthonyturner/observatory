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
  input,
  output,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FrameLoop } from '../../../core/instrument/frame-loop';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { ReleaseTimeline } from '../../../core/releases/release-timeline';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
import { PortraitPainter } from '../../../shared/planets/planet-portrait.types';
import { PlanetPortraits } from '../../../shared/planets/planet-portraits';
import { readOrreryPalette } from '../../orrery/orrery-canvas/orrery-palette';
import { releaseLook } from './release-look';
import { PlacedRelease, TimelineLayout, layoutTimeline } from './release-layout';
import { Stage } from './release-path';
import { PortraitRequest, ReleasePortraits, portraitKey } from './release-portraits';
import { ReleaseScene } from './release-scene';
import { skyMarks } from './sky-marks';

/** How much of the host the page's own chrome covers, in CSS pixels. */
export interface SkyInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

const FRAMES_PER_SECOND = 30;
const MAX_PIXEL_RATIO = 2;
/** Room round the trajectory inside the insets, for halos and names. */
const STAGE_MARGIN_PX = 36;
/** A timeline that lit in before a still page drew is shown fully lit. */
const FULLY_LIT_S = 60;
const NO_SIZE = { width: 0, height: 0 };

/**
 * The releases as a space timeline: a trajectory out of the past, each
 * release a star on it sized by what it shipped, ringed by its merged pull
 * requests, and the Unreleased comet at the leading edge. The canvas only
 * draws; each star is a button laid over it, so it can be hovered, focused
 * and picked like any other control.
 */
@Component({
  selector: 'app-release-sky',
  templateUrl: './release-sky.html',
  styleUrl: './release-sky.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReleaseSky {
  readonly timeline = input.required<ReleaseTimeline>();
  readonly selected = input<string | null>(null);
  readonly insets = input<SkyInsets>({ top: 0, right: 0, bottom: 0, left: 0 });
  /** A release's tag, or the Unreleased key. */
  readonly picked = output<string>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly motion = inject(MotionPreference);
  private readonly errors = inject(ErrorHandler);
  private readonly painter = inject(PlanetPortraits).painter();
  private readonly portraits = new ReleasePortraits(this.document, () => this.loop?.kick());
  private readonly size = toSignal(inject(ELEMENT_SIZE)(this.host), { initialValue: NO_SIZE });
  private scene: ReleaseScene | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private loop: FrameLoop | null = null;
  private shownAt: number | null = null;

  protected readonly stage = computed((): Stage => {
    const { width, height } = this.size();
    const { top, right, bottom, left } = this.insets();
    return {
      left: left + STAGE_MARGIN_PX,
      top: top + STAGE_MARGIN_PX,
      width: Math.max(0, width - left - right - STAGE_MARGIN_PX * 2),
      height: Math.max(0, height - top - bottom - STAGE_MARGIN_PX * 2),
    };
  });
  protected readonly layout = computed(() => layoutTimeline(this.timeline(), this.stage()));
  protected readonly marks = computed(() => skyMarks(this.layout(), this.stage()));

  constructor() {
    effect(() => {
      const [layout, timeline] = [this.layout(), this.timeline()];
      this.scene?.setLayout(layout, timeline);
      this.loop?.kick();
    });
    effect(() => {
      this.timeline();
      this.shownAt = null;
    });
    effect(() => this.resize(this.size()));
    effect(() => this.preparePortraits(this.painter(), this.layout()));
    effect(() => {
      this.selected();
      this.motion.isStill();
      this.loop?.kick();
    });
    afterNextRender(() => this.start());
    inject(DestroyRef).onDestroy(() => this.loop?.stop());
  }

  private start(): void {
    const canvas = this.canvas().nativeElement;
    this.context = canvas.getContext('2d');
    if (!this.context) return;
    this.scene = new ReleaseScene(this.document, readOrreryPalette(canvas));
    this.scene.setLayout(this.layout(), this.timeline());
    this.loop = new FrameLoop({
      scheduler: {
        request: (callback) => this.document.defaultView?.requestAnimationFrame(callback),
        isHidden: () => this.document.hidden,
        nowMs: () => performance.now(),
      },
      draw: (time, wall) => this.draw(time, wall),
      framesPerSecond: () => FRAMES_PER_SECOND,
      isStill: () => this.motion.isStill(),
      onError: (error) => this.errors.handleError(error),
    });
    this.resize(this.size());
    this.preparePortraits(this.painter(), this.layout());
    this.loop.kick();
  }

  /** Each release's star picture, painted once the shared painter has loaded. */
  private preparePortraits(painter: PortraitPainter | null, layout: TimelineLayout): void {
    const scene = this.scene;
    if (!painter || !scene) return;
    const requests = layout.releases.map((release) => this.requestOf(scene, release));
    try {
      this.portraits.prepare(painter, requests, this.pixelRatio());
    } catch (error: unknown) {
      console.warn('Release stars could not be painted; drawing flat glows.', error);
    }
  }

  private requestOf(scene: ReleaseScene, release: PlacedRelease): PortraitRequest {
    const look = releaseLook(release);
    return { type: look.type, ink: scene.inkOf(release.bump), radius: release.radius };
  }

  private draw(time: number, wall: number): void {
    const ctx = this.context;
    const scene = this.scene;
    if (!ctx || !scene) return;
    const isStill = this.motion.isStill();
    this.shownAt ??= wall;
    const ratio = this.pixelRatio();
    const { width, height } = this.size();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    scene.draw(ctx, {
      view: { width, height },
      stage: this.stage(),
      time,
      sinceShown: isStill ? FULLY_LIT_S : wall - this.shownAt,
      selected: this.selected(),
      isStill,
      portraitOf: (release) =>
        this.portraits.imageFor(portraitKey(this.requestOf(scene, release), ratio)),
    });
  }

  private resize(size: { width: number; height: number }): void {
    const canvas = this.canvas().nativeElement;
    const ratio = this.pixelRatio();
    canvas.width = Math.floor(size.width * ratio);
    canvas.height = Math.floor(size.height * ratio);
    this.loop?.kick();
  }

  private pixelRatio(): number {
    return Math.min(this.document.defaultView?.devicePixelRatio ?? 1, MAX_PIXEL_RATIO);
  }
}
