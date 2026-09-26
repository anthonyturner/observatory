import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  ErrorHandler,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FrameLoop } from '../../../core/instrument/frame-loop';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { OrreryCamera, Viewport } from '../../../core/orrery/orrery-camera';
import { DrawnWorld, pickWorld } from '../../../core/orrery/pick-world';
import { ChangeMark } from '../../../core/queue/changes';
import { Thread } from '../../../core/queue/collisions-report';
import { QueueItem } from '../../../core/queue/queue-report';
import { layoutStars } from '../../../core/queue/star-layout';
import { QueueFilter } from '../queue-view';
import { readChartPalette } from './chart-palette';
import { ChartScene } from './chart-scene';

const FRAMES_PER_SECOND = 30;
const MAX_PIXEL_RATIO = 2;
const CLICK_SLOP_PX = 5;
const WHEEL_ZOOM = 1.16;
const KEY_ZOOM = 1.2;
const KEY_PAN_PX = 90;
/** Room round the stars when the view is framed, for their labels. */
const FIT_MARGIN = 220;
/** Stars lit before a still page drew are shown full-grown. */
const FULLY_GROWN_S = 60;

/** The review queue as constellations on a full-window canvas. Drag, scroll
 *  or pinch to move; a click on a star picks its pull request. */
@Component({
  selector: 'app-star-chart',
  template: '<canvas #canvas aria-label="The review queue as a star map"></canvas>',
  styleUrl: './star-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.over]': 'isOverStar()',
    '[class.dragging]': 'isDragging()',
    '(document:keydown)': 'onKey($event)',
  },
})
export class StarChart {
  readonly items = input.required<readonly QueueItem[]>();
  readonly filter = input<QueueFilter>(null);
  /** The pull request whose panel is open, ringed on the chart. */
  readonly selected = input<number | null>(null);
  /** Stars that changed since you last looked. */
  readonly marks = input<ReadonlyMap<number, ChangeMark>>(new Map());
  /** Pull requests that would conflict with each other, or were never checked. */
  readonly threads = input<readonly Thread[]>([]);
  readonly picked = output<number>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly document = inject(DOCUMENT);
  private readonly motion = inject(MotionPreference);
  private readonly errors = inject(ErrorHandler);
  private readonly camera = new OrreryCamera();
  private readonly layout = computed(() => layoutStars(this.items()));
  private readonly teardown: (() => void)[] = [];
  private scene: ChartScene | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private loop: FrameLoop | null = null;
  private view: Viewport = { width: 0, height: 0 };
  private drawn: DrawnWorld[] = [];
  private shownAt: number | null = null;
  /** Framed once, on the first frame that has both a size and stars. */
  private isFramed = false;
  private lastWall: number | null = null;
  private pinch: number | null = null;
  protected press: { id: number; x: number; y: number; moved: number } | null = null;
  /** Signals, so the cursor follows: the canvas changes them outside any template event. */
  protected readonly isOverStar = signal(false);
  protected readonly isDragging = signal(false);

  constructor() {
    effect(() => {
      const layout = this.layout();
      this.scene?.setLayout(layout);
      if (layout.stars.length && this.shownAt === null) this.show();
      this.loop?.kick();
    });
    effect(() => {
      this.filter();
      this.selected();
      this.marks();
      this.threads();
      this.motion.isStill();
      this.loop?.kick();
    });
    afterNextRender(() => this.start());
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  zoomIn(): void {
    this.zoomAtCentre(KEY_ZOOM);
  }

  zoomOut(): void {
    this.zoomAtCentre(1 / KEY_ZOOM);
  }

  fit(): void {
    this.camera.fitBox(this.layout().bounds, this.view, FIT_MARGIN);
    this.loop?.kick();
  }

  private start(): void {
    const canvas = this.canvas().nativeElement;
    this.context = canvas.getContext('2d');
    if (!this.context) return;
    this.scene = new ChartScene(this.document, readChartPalette(canvas));
    this.scene.setLayout(this.layout());
    this.loop = new FrameLoop({
      scheduler: {
        request: (callback) => this.document.defaultView?.requestAnimationFrame(callback),
        isHidden: () => this.document.hidden,
        nowMs: () => performance.now(),
      },
      draw: (time, wall) => this.draw(time, wall),
      framesPerSecond: () => FRAMES_PER_SECOND,
      isStill: () => this.motion.isStill() && !this.press,
      onError: (error) => this.errors.handleError(error),
    });
    this.resize();
    if (this.layout().stars.length && this.shownAt === null) this.show();
    this.listen(canvas);
    this.loop.kick();
  }

  private show(): void {
    this.shownAt = performance.now() / 1000;
  }

  /** The stars can arrive before the canvas has a size, so framing waits for both. */
  private frameOnce(): void {
    if (this.isFramed || !this.view.width || !this.layout().stars.length) return;
    this.camera.fitBox(this.layout().bounds, this.view, FIT_MARGIN);
    this.camera.settle();
    this.isFramed = true;
  }

  private draw(time: number, wall: number): void {
    const ctx = this.context;
    if (!ctx || !this.scene) return;
    this.frameOnce();
    const dt = this.lastWall === null ? 0 : Math.min(wall - this.lastWall, 0.1);
    this.lastWall = wall;
    const isStill = this.motion.isStill();
    if (isStill) this.camera.settle();
    else this.camera.advance(dt, this.press !== null);
    const ratio = Math.min(this.document.defaultView?.devicePixelRatio ?? 1, MAX_PIXEL_RATIO);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, this.view.width, this.view.height);
    this.drawn = this.scene.draw(ctx, {
      view: this.view,
      camera: this.camera,
      time,
      sinceShown: isStill || this.shownAt === null ? FULLY_GROWN_S : wall - this.shownAt,
      isStill,
      filter: this.filter(),
      selected: this.selected(),
      marks: this.marks(),
      threads: this.threads(),
    });
  }

  private resize(): void {
    const window = this.document.defaultView;
    if (!window) return;
    const canvas = this.canvas().nativeElement;
    const ratio = Math.min(window.devicePixelRatio ?? 1, MAX_PIXEL_RATIO);
    this.view = { width: window.innerWidth, height: window.innerHeight };
    canvas.width = Math.floor(this.view.width * ratio);
    canvas.height = Math.floor(this.view.height * ratio);
    this.scene?.resize(this.view);
    this.loop?.kick();
  }

  private listen(canvas: HTMLCanvasElement): void {
    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      canvas.addEventListener(type, handler, options);
      this.teardown.push(() => canvas.removeEventListener(type, handler));
    };
    on('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      this.press = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 };
      this.isDragging.set(true);
      this.camera.stopDrift();
      this.loop?.kick();
    });
    on('pointermove', (event) => this.onPointerMove(event));
    on('pointerup', (event) => {
      const wasClick = this.press !== null && this.press.moved < CLICK_SLOP_PX;
      this.press = null;
      this.isDragging.set(false);
      if (wasClick) this.pickAt(event.clientX, event.clientY);
      this.loop?.kick();
    });
    on('pointercancel', () => {
      this.press = null;
      this.isDragging.set(false);
    });
    on(
      'wheel',
      (event) => {
        event.preventDefault();
        const factor = event.deltaY < 0 ? WHEEL_ZOOM : 1 / WHEEL_ZOOM;
        this.camera.zoomAt(event.clientX, event.clientY, factor, this.view);
        this.loop?.kick();
      },
      { passive: false },
    );
    on('touchmove', (event) => this.onTouchMove(event), { passive: false });
    on('touchend', () => (this.pinch = null));
    const window = this.document.defaultView;
    const resize = () => this.resize();
    window?.addEventListener('resize', resize);
    this.teardown.push(() => window?.removeEventListener('resize', resize));
  }

  private onPointerMove(event: PointerEvent): void {
    const press = this.press;
    if (!press || press.id !== event.pointerId) {
      this.isOverStar.set(pickWorld(this.drawn, event.clientX, event.clientY) !== null);
      return;
    }
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    press.moved += Math.abs(dx) + Math.abs(dy);
    press.x = event.clientX;
    press.y = event.clientY;
    this.camera.drag(dx, dy);
    this.loop?.kick();
  }

  private onTouchMove(event: TouchEvent): void {
    if (event.touches.length !== 2) return;
    event.preventDefault();
    const [a, b] = [event.touches[0], event.touches[1]];
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (this.pinch) {
      const cx = (a.clientX + b.clientX) / 2;
      const cy = (a.clientY + b.clientY) / 2;
      this.camera.zoomAt(cx, cy, distance / this.pinch, this.view);
      this.loop?.kick();
    }
    this.pinch = distance;
  }

  private pickAt(x: number, y: number): void {
    const key = pickWorld(this.drawn, x, y);
    if (key) this.picked.emit(Number(key));
  }

  protected onKey(event: KeyboardEvent): void {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('input, textarea, select, [contenteditable], [role="dialog"]')
    ) {
      return;
    }
    const pans: Record<string, readonly [number, number]> = {
      ArrowLeft: [-KEY_PAN_PX, 0],
      ArrowRight: [KEY_PAN_PX, 0],
      ArrowUp: [0, -KEY_PAN_PX],
      ArrowDown: [0, KEY_PAN_PX],
    };
    const pan = pans[event.key];
    if (pan) {
      event.preventDefault();
      this.camera.pan(pan[0], pan[1]);
      this.loop?.kick();
    } else if (event.key === '+' || event.key === '=') {
      this.zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      this.zoomOut();
    }
  }

  private zoomAtCentre(factor: number): void {
    this.camera.zoomAt(this.view.width / 2, this.view.height / 2, factor, this.view);
    this.loop?.kick();
  }

  private stop(): void {
    this.loop?.stop();
    for (const undo of this.teardown) undo();
  }
}
