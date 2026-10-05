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
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FrameLoop } from '../../../core/instrument/frame-loop';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { OrreryCamera, Viewport } from '../../../core/orrery/orrery-camera';
import { DrawnWorld, pickWorld } from '../../../core/orrery/pick-world';
import { OrreryWorld, outermostOrbit } from '../../../core/orrery/world-layout';
import { OrreryPalette, readOrreryPalette } from './orrery-palette';
import { OrreryScene, SceneFrame } from './orrery-scene';
import type { OrreryWebGL } from './webgl/orrery-webgl';
import { CardHover } from './card-hover';
import { ShippedItem } from '../../../core/orrery/shipped';
import { ShippedLayer } from './shipped-layer';

/** A speck whose project has no world on show: a cool white. */
const SHIPPED_FALLBACK = '200, 215, 255';

const FRAMES_PER_SECOND = 30;
/** Retina and beyond cost more than they show on a moving sky. */
const MAX_PIXEL_RATIO = 2;
/** A press that moves less than this is a click, not a drag. */
const CLICK_SLOP_PX = 5;
const WHEEL_ZOOM = 1.16;
const KEY_ZOOM = 1.2;
const KEY_PAN_PX = 90;
/** Worlds that grew in before a still page drew are shown full-grown. */
const FULLY_GROWN_S = 60;

interface Press {
  readonly id: number;
  x: number;
  y: number;
  moved: number;
}

/**
 * The orrery on a full-window canvas: drag to pan, scroll or pinch to zoom,
 * hover a world to show its card, click to pin it. It draws in 2D at once and
 * in 3D once Three.js has loaded and can draw, with the labels kept on the 2D
 * canvas over it; losing the 3D view for any reason goes back to 2D for good.
 */
@Component({
  selector: 'app-orrery-canvas',
  template: '<canvas #canvas aria-label="Orrery of every project"></canvas>',
  styleUrl: './orrery-canvas.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.over]': 'isOverWorld()',
    '[class.dragging]': 'isDragging()',
    '(document:keydown)': 'onKey($event)',
  },
})
export class OrreryCanvas {
  readonly worlds = input.required<readonly OrreryWorld[]>();
  /** The repository of the world whose card is shown, or null. */
  readonly selected = model<string | null>(null);
  /** What every shown project merged lately: specks in the Milky Way. */
  readonly shipped = input<readonly ShippedItem[]>([]);
  /** Asks to open a world's review queue: a click, or a second tap on a touch screen. */
  readonly open = output<string>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly document = inject(DOCUMENT);
  private readonly motion = inject(MotionPreference);
  private readonly errors = inject(ErrorHandler);
  private readonly camera = new OrreryCamera();
  private readonly shippedLayer = new ShippedLayer();
  /** A project's world colour as `r, g, b`, so its specks match its world. */
  private readonly colourOf = (repo: string): string => {
    const world = this.worlds().find((each) => each.project.repo === repo);
    return world && this.palette ? this.palette.channels(world.color) : SHIPPED_FALLBACK;
  };
  private readonly teardown: (() => void)[] = [];
  private scene: OrreryScene | null = null;
  private palette: OrreryPalette | null = null;
  /** The 3D view, once it has loaded and while it can draw. */
  private webgl: OrreryWebGL | null = null;
  private isStopped = false;
  private context: CanvasRenderingContext2D | null = null;
  private loop: FrameLoop | null = null;
  private view: Viewport = { width: 0, height: 0 };
  private drawn: DrawnWorld[] = [];
  private shownAt: number | null = null;
  /** Framed once, on the first frame that has both a size and worlds. */
  private isFramed = false;
  private lastWall: number | null = null;
  private pointer: { x: number; y: number } | null = null;
  private pinned: string | null = null;
  private readonly cardHover = new CardHover({
    selected: () => this.selected(),
    select: (key) => this.selected.set(key),
    isPinned: () => this.pinned !== null,
  });
  private pinch: number | null = null;
  protected press: Press | null = null;
  /** Signals, so the cursor follows: the canvas changes them outside any template event. */
  protected readonly isOverWorld = signal(false);
  protected readonly isDragging = signal(false);

  constructor() {
    effect(() => {
      const worlds = this.worlds();
      this.scene?.setWorlds(worlds);
      if (this.webgl) void this.giveWorlds(this.webgl, worlds);
      if (worlds.length && this.shownAt === null) this.showSystem();
      this.loop?.kick();
    });
    effect(() => {
      this.shippedLayer.set(this.shipped(), Date.now());
      this.loop?.kick();
    });
    effect(() => {
      if (this.selected() === null) this.pinned = null;
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
    this.camera.fit(outermostOrbit(this.worlds()), this.view);
    this.loop?.kick();
  }

  /** The card is under the pointer: keep it. */
  holdCard(): void {
    this.cardHover.hold();
  }

  /** The pointer left the card: let it go, unless it was pinned. */
  releaseCard(): void {
    this.cardHover.release();
  }

  private start(): void {
    const canvas = this.canvas().nativeElement;
    this.context = canvas.getContext('2d');
    if (!this.context) return;
    this.palette = readOrreryPalette(canvas);
    this.scene = new OrreryScene(this.document, this.palette);
    this.scene.setWorlds(this.worlds());
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
    if (this.worlds().length && this.shownAt === null) this.showSystem();
    this.listen(canvas);
    this.loop.kick();
    void this.upgrade(canvas);
  }

  /** Loads the 3D view and moves to it where it can draw; anything that goes
   *  wrong, from the download to a shader, keeps the 2D orrery. */
  private async upgrade(canvas: HTMLCanvasElement): Promise<void> {
    try {
      const { OrreryWebGL } = await import('./webgl/orrery-webgl');
      if (this.isStopped || !this.palette) return;
      const webgl = new OrreryWebGL(this.document, this.palette, () => this.dropWebgl());
      // The 2D orrery keeps drawing while the shaders compile, which can take seconds.
      const worlds = this.worlds();
      await webgl.setWorlds(worlds);
      if (this.isStopped) {
        webgl.dispose();
        return;
      }
      webgl.mount(canvas);
      webgl.resize(this.view.width, this.view.height, this.pixelRatio());
      this.webgl = webgl;
      if (this.worlds() !== worlds) void this.giveWorlds(webgl, this.worlds());
      this.loop?.kick();
    } catch (error: unknown) {
      console.warn('The 3D orrery is unavailable; drawing in 2D.', error);
    }
  }

  private async giveWorlds(webgl: OrreryWebGL, worlds: readonly OrreryWorld[]): Promise<void> {
    try {
      await webgl.setWorlds(worlds);
      this.loop?.kick();
    } catch (error: unknown) {
      console.warn('The 3D orrery could not show the new worlds; drawing in 2D.', error);
      if (this.webgl === webgl) this.dropWebgl();
    }
  }

  private dropWebgl(): void {
    const failed = this.webgl;
    this.webgl = null;
    try {
      failed?.dispose();
    } catch {
      // The context may already be gone.
    }
    this.loop?.kick();
  }

  private showSystem(): void {
    this.shownAt = performance.now() / 1000;
  }

  /** The worlds can arrive before the canvas has a size (projects already
   *  read on Home), so framing waits for both. */
  private frameOnce(): void {
    if (this.isFramed || !this.view.width || !this.worlds().length) return;
    this.camera.fit(outermostOrbit(this.worlds()), this.view);
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

    const ratio = this.pixelRatio();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, this.view.width, this.view.height);
    const frame: SceneFrame = {
      view: this.view,
      camera: this.camera,
      time,
      sinceShown: isStill || this.shownAt === null ? FULLY_GROWN_S : wall - this.shownAt,
      isStill,
      selectedKey: this.selected(),
    };
    this.drawn = this.drawFrame(ctx, frame);
    this.shippedLayer.draw(ctx, frame, wall, this.drawn, this.colourOf);
    // Worlds move under a still pointer, so what it rests on can change.
    if (this.pointer && !this.press) this.hoverAt(this.pointer.x, this.pointer.y);
  }

  /** In 3D with the labels over it, or, where 3D cannot draw, all in 2D. */
  private drawFrame(ctx: CanvasRenderingContext2D, frame: SceneFrame) {
    const scene = this.scene!;
    if (this.webgl) {
      try {
        this.webgl.frame(frame);
        return scene.drawOverlay(ctx, frame);
      } catch (error: unknown) {
        console.warn('The 3D orrery stopped drawing; drawing in 2D.', error);
        this.dropWebgl();
        ctx.clearRect(0, 0, frame.view.width, frame.view.height);
      }
    }
    return scene.draw(ctx, frame);
  }

  private pixelRatio(): number {
    return Math.min(this.document.defaultView?.devicePixelRatio ?? 1, MAX_PIXEL_RATIO);
  }

  private resize(): void {
    const window = this.document.defaultView;
    const canvas = this.canvas().nativeElement;
    if (!window) return;
    const ratio = this.pixelRatio();
    this.view = { width: window.innerWidth, height: window.innerHeight };
    canvas.width = Math.floor(this.view.width * ratio);
    canvas.height = Math.floor(this.view.height * ratio);
    this.scene?.resize(this.view);
    this.webgl?.resize(this.view.width, this.view.height, ratio);
    this.loop?.kick();
  }

  private listen(canvas: HTMLCanvasElement): void {
    const window = this.document.defaultView;
    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      canvas.addEventListener(type, handler, options);
      this.teardown.push(() => canvas.removeEventListener(type, handler));
    };
    on('pointerdown', (event) => this.onPointerDown(canvas, event));
    on('pointermove', (event) => this.onPointerMove(event));
    on('pointerup', (event) => this.onPointerUp(event));
    on('pointercancel', () => {
      this.press = null;
      this.isDragging.set(false);
    });
    on('pointerleave', () => this.onPointerLeave());
    on('wheel', (event) => this.onWheel(event), { passive: false });
    on('touchmove', (event) => this.onTouchMove(event), { passive: false });
    on('touchend', () => (this.pinch = null));
    const resize = () => this.resize();
    window?.addEventListener('resize', resize);
    this.teardown.push(() => window?.removeEventListener('resize', resize));
  }

  private onPointerDown(canvas: HTMLCanvasElement, event: PointerEvent): void {
    canvas.setPointerCapture(event.pointerId);
    this.press = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 };
    this.isDragging.set(true);
    this.camera.stopDrift();
    this.loop?.kick();
  }

  private onPointerMove(event: PointerEvent): void {
    // A finger has no hover: on a touch screen only a tap picks a world.
    if (event.pointerType !== 'touch') this.pointer = { x: event.clientX, y: event.clientY };
    const press = this.press;
    if (!press || press.id !== event.pointerId) {
      if (event.pointerType !== 'touch') this.hoverAt(event.clientX, event.clientY);
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

  private onPointerUp(event: PointerEvent): void {
    const wasClick = this.press !== null && this.press.moved < CLICK_SLOP_PX;
    this.press = null;
    this.isDragging.set(false);
    if (wasClick) {
      this.camera.stopDrift();
      this.clickAt(event.clientX, event.clientY, event.pointerType === 'touch');
    }
    this.loop?.kick();
  }

  private onPointerLeave(): void {
    this.pointer = null;
    this.isOverWorld.set(false);
    this.cardHover.release();
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.camera.zoomAt(
      event.clientX,
      event.clientY,
      event.deltaY < 0 ? WHEEL_ZOOM : 1 / WHEEL_ZOOM,
      this.view,
    );
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

  protected onKey(event: KeyboardEvent): void {
    if (
      event.target instanceof Element &&
      event.target.closest('input, textarea, select, [contenteditable]')
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

  private hoverAt(x: number, y: number): void {
    const key = pickWorld(this.drawn, x, y);
    // A world is in front of the Milky Way, so only open sky offers a speck.
    const speck = key === null ? this.shippedLayer.pick(x, y) : null;
    if (this.shippedLayer.hoverOn(speck)) this.loop?.kick();
    this.isOverWorld.set(key !== null || speck !== null);
    this.cardHover.over(key);
  }

  /** A click opens the world's review queue. A touch screen has no hover, so
   *  its first tap shows the card and a second tap on the same world opens it.
   *  A click on empty sky clears the card. */
  private clickAt(x: number, y: number, isTouch: boolean): void {
    const key = pickWorld(this.drawn, x, y);
    this.cardHover.cancel();
    // A shipped speck opens its project's review queue, where its Spiral of Done is.
    const speck = key === null ? this.shippedLayer.pick(x, y) : null;
    if (speck) return this.open.emit(speck.repo);
    const isFirstTap = isTouch && key !== this.selected();
    if (key && !isFirstTap) {
      this.open.emit(key);
      return;
    }
    this.pinned = key;
    this.selected.set(key);
  }

  private stop(): void {
    this.isStopped = true;
    this.loop?.stop();
    this.dropWebgl();
    this.cardHover.cancel();
    for (const undo of this.teardown) undo();
  }
}
