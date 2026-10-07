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
import { ActionsRun } from '../../../core/actions/actions-report';
import { FrameLoop } from '../../../core/instrument/frame-loop';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
import { PortraitPainter } from '../../../shared/planets/planet-portrait.types';
import { PlanetPortraits } from '../../../shared/planets/planet-portraits';
import { PortraitRequest, SunPortraits, portraitKey } from '../../../shared/planets/sun-portraits';
import { readOrreryPalette } from '../../orrery/orrery-canvas/orrery-palette';
import { Stage } from '../../releases/release-sky/release-path';
import { SkyInsets } from '../../releases/release-sky/release-sky';
import { LaneLayout, PlacedRun, layoutLanes } from './run-lanes';
import { runStarType } from './run-look';
import { runMarks } from './run-marks';
import { RunScene } from './run-scene';

const FRAMES_PER_SECOND = 30;
const MAX_PIXEL_RATIO = 2;
/** Room round the lanes inside the insets, for halos and flares. */
const STAGE_MARGIN_PX = 30;
/** Runs that lit in before a still page drew are shown fully lit. */
const FULLY_LIT_S = 60;
const NO_SIZE = { width: 0, height: 0 };

/**
 * The runs as a sky: each workflow a lane running back from the present, each
 * run a star on it. The canvas only draws; each star is a button laid over
 * it, so it can be hovered, focused and picked like any other control.
 */
@Component({
  selector: 'app-run-sky',
  templateUrl: './run-sky.html',
  styleUrl: './run-sky.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunSky {
  /** Newest first. */
  readonly runs = input.required<readonly ActionsRun[]>();
  /** When the runs were read: the present, at the lanes' near end. */
  readonly now = input.required<number>();
  readonly selected = input<string | null>(null);
  readonly insets = input<SkyInsets>({ top: 0, right: 0, bottom: 0, left: 0 });
  /** A run's id, as text. */
  readonly picked = output<string>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly motion = inject(MotionPreference);
  private readonly errors = inject(ErrorHandler);
  private readonly painter = inject(PlanetPortraits).painter();
  private readonly portraits = new SunPortraits(this.document, () => this.loop?.kick());
  private readonly size = toSignal(inject(ELEMENT_SIZE)(this.host), { initialValue: NO_SIZE });
  private scene: RunScene | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private loop: FrameLoop | null = null;
  private shownAt: number | null = null;

  private readonly stage = computed((): Stage => {
    const { width, height } = this.size();
    const { top, right, bottom, left } = this.insets();
    return {
      left: left + STAGE_MARGIN_PX,
      top: top + STAGE_MARGIN_PX,
      width: Math.max(0, width - left - right - STAGE_MARGIN_PX * 2),
      height: Math.max(0, height - top - bottom - STAGE_MARGIN_PX * 2),
    };
  });
  private readonly layout = computed(() => layoutLanes(this.runs(), this.now(), this.stage()));
  protected readonly marks = computed(() => runMarks(this.layout(), this.now()));

  constructor() {
    effect(() => {
      // Read before the scene exists too, or the effect tracks nothing and never runs again.
      const layout = this.layout();
      this.scene?.setLayout(layout);
      this.loop?.kick();
    });
    effect(() => {
      this.runs();
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
    this.scene = new RunScene(this.document, readOrreryPalette(canvas));
    this.scene.setLayout(this.layout());
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

  /** Each run's star picture, painted once the shared painter has loaded. */
  private preparePortraits(painter: PortraitPainter | null, layout: LaneLayout): void {
    const scene = this.scene;
    if (!painter || !scene) return;
    const requests = layout.runs.map((run) => this.requestOf(scene, run));
    try {
      this.portraits.prepare(painter, requests, this.pixelRatio());
    } catch (error: unknown) {
      console.warn('Run stars could not be painted; drawing flat glows.', error);
    }
  }

  private requestOf(scene: RunScene, run: PlacedRun): PortraitRequest {
    const { outcome } = run.run;
    return { type: runStarType(outcome), ink: scene.inkOf(outcome), radius: run.radius };
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
      time,
      sinceShown: isStill ? FULLY_LIT_S : wall - this.shownAt,
      selected: this.selected(),
      isStill,
      portraitOf: (run) => this.portraits.imageFor(portraitKey(this.requestOf(scene, run), ratio)),
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
