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
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { planetLook } from '../../../core/architecture/planet-look';
import { FrameLoop } from '../../../core/instrument/frame-loop';
import { Milestone } from '../../../core/milestones/milestones-report';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
import { PaintedImages, portraitPixels } from '../../../shared/planets/painted-images';
import { PortraitPainter, WORLD_FRAME } from '../../../shared/planets/planet-portrait.types';
import { PlanetPortraits } from '../../../shared/planets/planet-portraits';
import { readOrreryPalette } from '../../orrery/orrery-canvas/orrery-palette';
import { Stage } from '../../releases/release-sky/release-path';
import { SkyInsets } from '../../releases/release-sky/release-sky';
import { PlacedMilestone, TransitLayout, layoutTransit } from './transit-lanes';
import { transitMarks } from './transit-marks';
import { TransitScene } from './transit-scene';

const FRAMES_PER_SECOND = 30;
const MAX_PIXEL_RATIO = 2;
/** Room round the lanes inside the insets, for halos and words. */
const STAGE_MARGIN_PX = 30;
const NO_SIZE = { width: 0, height: 0 };
/** The planets' sun sits off the upper left, where every lane launches from. */
const SUN_SIDE = { x: 1, y: 0.4 };
/** Enough pictures for every planet at a few sizes; past it the cache starts over. */
const MAX_PICTURES = 60;

/**
 * The open milestones as planets in transit: each a lane from launch on the
 * left to arrival on the right, its planet as far along as the milestone is
 * done, its air the colour of how it stands against its date. The canvas only
 * draws; each planet is a link laid over it, so it can be hovered, focused and
 * opened on GitHub like any other.
 */
@Component({
  selector: 'app-transit-sky',
  templateUrl: './transit-sky.html',
  styleUrl: './transit-sky.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransitSky {
  readonly repo = input.required<string>();
  /** Soonest due first. */
  readonly milestones = input.required<readonly Milestone[]>();
  /** When the report was made, which due dates are counted from. */
  readonly now = input.required<number>();
  readonly insets = input<SkyInsets>({ top: 0, right: 0, bottom: 0, left: 0 });

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly motion = inject(MotionPreference);
  private readonly errors = inject(ErrorHandler);
  private readonly painter = inject(PlanetPortraits).painter();
  private readonly pictures = new PaintedImages(
    this.document,
    () => this.loop?.kick(),
    MAX_PICTURES,
  );
  private readonly size = toSignal(inject(ELEMENT_SIZE)(this.host), { initialValue: NO_SIZE });
  private scene: TransitScene | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private loop: FrameLoop | null = null;

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
  private readonly layout = computed(() =>
    layoutTransit(this.milestones(), this.stage(), this.now()),
  );
  protected readonly marks = computed(() => transitMarks(this.layout(), this.now()));

  constructor() {
    effect(() => {
      // Read before the scene exists too, or the effect tracks nothing and never runs again.
      const layout = this.layout();
      this.scene?.setLayout(layout);
      this.loop?.kick();
    });
    effect(() => this.resize(this.size()));
    effect(() => this.preparePortraits(this.painter(), this.layout()));
    effect(() => {
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
    this.scene = new TransitScene(this.document, readOrreryPalette(canvas));
    this.scene.setLayout(this.layout());
    this.loop = new FrameLoop({
      scheduler: {
        request: (callback) => this.document.defaultView?.requestAnimationFrame(callback),
        isHidden: () => this.document.hidden,
        nowMs: () => performance.now(),
      },
      draw: (time) => this.draw(time),
      framesPerSecond: () => FRAMES_PER_SECOND,
      isStill: () => this.motion.isStill(),
      onError: (error) => this.errors.handleError(error),
    });
    this.resize(this.size());
    this.preparePortraits(this.painter(), this.layout());
    this.loop.kick();
  }

  /** Each planet's picture, painted as the Orrery paints a world once the shared painter has loaded. */
  private preparePortraits(painter: PortraitPainter | null, layout: TransitLayout): void {
    const scene = this.scene;
    if (!painter || !scene) return;
    try {
      for (const lane of layout.lanes) {
        const look = planetLook(this.lookId(lane), SUN_SIDE.x, SUN_SIDE.y);
        const px = this.pixelsOf(lane);
        this.pictures.ensure(this.pictureKey(lane), () =>
          painter.world({ ...look, air: scene.inkOf(lane.state), px }),
        );
      }
    } catch (error: unknown) {
      console.warn('Milestone planets could not be painted; drawing flat discs.', error);
    }
  }

  private lookId(lane: PlacedMilestone): string {
    return `${this.repo()}#${lane.milestone.number}`;
  }

  private pixelsOf(lane: PlacedMilestone): number {
    return portraitPixels(lane.radius, WORLD_FRAME, this.pixelRatio());
  }

  private pictureKey(lane: PlacedMilestone): string {
    return `${this.lookId(lane)}|${lane.state}|${this.pixelsOf(lane)}`;
  }

  private draw(time: number): void {
    const ctx = this.context;
    const scene = this.scene;
    if (!ctx || !scene) return;
    const ratio = this.pixelRatio();
    const { width, height } = this.size();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    scene.draw(ctx, {
      view: { width, height },
      time,
      isStill: this.motion.isStill(),
      portraitOf: (lane) => this.pictures.imageFor(this.pictureKey(lane)),
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
