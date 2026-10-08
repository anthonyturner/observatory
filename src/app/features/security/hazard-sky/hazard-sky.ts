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
import { MotionPreference } from '../../../core/motion/motion-preference';
import { AlertSeverity } from '../../../core/security/security-report';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
import { PortraitPainter, WORLD_FRAME } from '../../../shared/planets/planet-portrait.types';
import { PlanetPortraits } from '../../../shared/planets/planet-portraits';
import { OrreryPalette, readOrreryPalette } from '../../orrery/orrery-canvas/orrery-palette';
import { Stage } from '../../releases/release-sky/release-path';
import { SkyInsets } from '../../releases/release-sky/release-sky';
import { Hazard, layoutBelts } from './hazard-belts';
import { SEVERITY_TOKEN } from './hazard-look';
import { hazardMarks } from './hazard-marks';
import { HazardScene } from './hazard-scene';

const FRAMES_PER_SECOND = 30;
const MAX_PIXEL_RATIO = 2;
/** Room round the belts inside the insets, for halos and throbs. */
const STAGE_MARGIN_PX = 30;
const NO_SIZE = { width: 0, height: 0 };
/** The world's sun sits off its upper left, so it is lit from there. */
const SUN_SIDE = { x: 1, y: 0.6 };
/** Sizes are rounded up to a step, so a resize repaints the world only now and then. */
const WORLD_STEP_PX = 32;
const MAX_WORLD_PX = 512;
const CLEAR_TOKEN = 'security-clear';

interface WorldPicture {
  readonly key: string;
  readonly image: HTMLImageElement;
  isLoaded: boolean;
}

/**
 * The open alerts as hazards round the project's world: each grade a belt,
 * worst innermost, each alert a tumbling mark shaped by its kind. The canvas
 * only draws; each alert's mark is a link laid over it, so it can be hovered,
 * focused and opened on GitHub like any other link.
 */
@Component({
  selector: 'app-hazard-sky',
  templateUrl: './hazard-sky.html',
  styleUrl: './hazard-sky.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HazardSky {
  readonly repo = input.required<string>();
  /** Most severe first. */
  readonly hazards = input.required<readonly Hazard[]>();
  /** The worst open grade, which colours the world's air; null for none. */
  readonly worst = input<AlertSeverity | null>(null);
  /** When the report was made. */
  readonly now = input.required<number>();
  readonly insets = input<SkyInsets>({ top: 0, right: 0, bottom: 0, left: 0 });

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly motion = inject(MotionPreference);
  private readonly errors = inject(ErrorHandler);
  private readonly painter = inject(PlanetPortraits).painter();
  private readonly size = toSignal(inject(ELEMENT_SIZE)(this.host), { initialValue: NO_SIZE });
  private scene: HazardScene | null = null;
  private palette: OrreryPalette | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private loop: FrameLoop | null = null;
  private world: WorldPicture | null = null;

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
  private readonly layout = computed(() => layoutBelts(this.hazards(), this.stage(), this.repo()));
  protected readonly marks = computed(() => hazardMarks(this.layout(), this.now()));
  private readonly airToken = computed(() => {
    const worst = this.worst();
    return worst ? SEVERITY_TOKEN[worst] : CLEAR_TOKEN;
  });

  constructor() {
    effect(() => {
      // Read before the scene exists too, or the effect tracks nothing and never runs again.
      const layout = this.layout();
      this.scene?.setLayout(layout);
      this.loop?.kick();
    });
    effect(() => this.resize(this.size()));
    effect(() => this.prepareWorld(this.painter(), this.layout().worldRadius, this.airToken()));
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
    this.palette = readOrreryPalette(canvas);
    this.scene = new HazardScene(this.document, this.palette);
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
    this.prepareWorld(this.painter(), this.layout().worldRadius, this.airToken());
    this.loop.kick();
  }

  /** The project's world, painted as the Orrery paints it once the shared painter has loaded. */
  private prepareWorld(painter: PortraitPainter | null, radius: number, airToken: string): void {
    const palette = this.palette;
    if (!painter || !palette || radius <= 0) return;
    const steps = Math.ceil((radius * WORLD_FRAME * 2 * this.pixelRatio()) / WORLD_STEP_PX);
    const px = Math.min(MAX_WORLD_PX, steps * WORLD_STEP_PX);
    const key = `${this.repo()}|${airToken}|${px}`;
    if (this.world?.key === key) return;
    const look = planetLook(this.repo(), SUN_SIDE.x, SUN_SIDE.y);
    try {
      const picture: WorldPicture = {
        key,
        image: this.document.createElement('img'),
        isLoaded: false,
      };
      picture.image.onload = () => {
        picture.isLoaded = true;
        this.loop?.kick();
      };
      picture.image.src = painter.world({
        ...look,
        air: palette.channels(`var(--${airToken})`),
        px,
      });
      this.world = picture;
    } catch (error: unknown) {
      console.warn('The world could not be painted; drawing a flat one.', error);
    }
  }

  private draw(time: number): void {
    const { context: ctx, scene, palette } = this;
    if (!ctx || !scene || !palette) return;
    const ratio = this.pixelRatio();
    const { width, height } = this.size();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const world = this.world?.isLoaded ? this.world.image : null;
    scene.draw(ctx, {
      view: { width, height },
      time,
      isStill: this.motion.isStill(),
      world,
      air: palette.channels(`var(--${this.airToken()})`),
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
