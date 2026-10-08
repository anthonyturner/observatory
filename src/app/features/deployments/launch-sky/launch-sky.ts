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
import { DeployEnvironment } from '../../../core/deployments/deployments-report';
import { FrameLoop } from '../../../core/instrument/frame-loop';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
import { PortraitPainter } from '../../../shared/planets/planet-portrait.types';
import { PlanetPortraits } from '../../../shared/planets/planet-portraits';
import { PortraitRequest, SunPortraits, portraitKey } from '../../../shared/planets/sun-portraits';
import { readOrreryPalette } from '../../orrery/orrery-canvas/orrery-palette';
import { Stage } from '../../releases/release-sky/release-path';
import { SkyInsets } from '../../releases/release-sky/release-sky';
import { beaconStarType } from '../deploy-look';
import { launchMarks } from './launch-marks';
import { PadLayout, PlacedDeployment, layoutPads } from './launch-pads';
import { LaunchScene } from './launch-scene';

const FRAMES_PER_SECOND = 30;
const MAX_PIXEL_RATIO = 2;
/** Room round the pads and trails inside the insets, for halos and labels. */
const STAGE_MARGIN_PX = 30;
const NO_SIZE = { width: 0, height: 0 };

/**
 * The deployments as a sky: each environment a launch pad, its latest
 * deployment a beacon above it and the earlier ones a trail climbing away.
 * The canvas only draws; each light is a link laid over it, so it can be
 * hovered, focused and followed like any other.
 */
@Component({
  selector: 'app-launch-sky',
  templateUrl: './launch-sky.html',
  styleUrl: './launch-sky.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaunchSky {
  /** Production first, each with its deployments newest first. */
  readonly environments = input.required<readonly DeployEnvironment[]>();
  /** When the report was made, which ages are counted from. */
  readonly now = input.required<number>();
  readonly insets = input<SkyInsets>({ top: 0, right: 0, bottom: 0, left: 0 });

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly motion = inject(MotionPreference);
  private readonly errors = inject(ErrorHandler);
  private readonly painter = inject(PlanetPortraits).painter();
  private readonly portraits = new SunPortraits(this.document, () => this.loop?.kick());
  private readonly size = toSignal(inject(ELEMENT_SIZE)(this.host), { initialValue: NO_SIZE });
  private scene: LaunchScene | null = null;
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
  private readonly layout = computed(() => layoutPads(this.environments(), this.stage()));
  protected readonly marks = computed(() => launchMarks(this.layout(), this.now()));

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
    this.scene = new LaunchScene(this.document, readOrreryPalette(canvas));
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

  /** Each light's star picture, painted once the shared painter has loaded. */
  private preparePortraits(painter: PortraitPainter | null, layout: PadLayout): void {
    const scene = this.scene;
    if (!painter || !scene) return;
    const requests = layout.deployments.map((light) => this.requestOf(scene, light));
    try {
      this.portraits.prepare(painter, requests, this.pixelRatio());
    } catch (error: unknown) {
      console.warn('Deployment lights could not be painted; drawing flat glows.', error);
    }
  }

  private requestOf(scene: LaunchScene, light: PlacedDeployment): PortraitRequest {
    const { outcome } = light.deployment;
    return { type: beaconStarType(outcome), ink: scene.inkOf(outcome), radius: light.radius };
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
      portraitOf: (light) =>
        this.portraits.imageFor(portraitKey(this.requestOf(scene, light), ratio)),
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
