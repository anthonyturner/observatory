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
  viewChild,
} from '@angular/core';
import { FrameLoop } from '../../../core/instrument/frame-loop';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { OrreryCamera, Viewport } from '../../../core/orrery/orrery-camera';
import { DrawnWorld, pickWorld } from '../../../core/orrery/pick-world';
import { OrreryWorld, outermostOrbit } from '../../../core/orrery/world-layout';
import { readOrreryPalette } from './orrery-palette';
import { OrreryScene } from './orrery-scene';

const FRAMES_PER_SECOND = 30;
/** Retina and beyond cost more than they show on a moving sky. */
const MAX_PIXEL_RATIO = 2;
/** A press that moves less than this is a click, not a drag. */
const CLICK_SLOP_PX = 5;
const WHEEL_ZOOM = 1.16;
const KEY_ZOOM = 1.2;
const KEY_PAN_PX = 90;
/** A hover card lingers this long, so the pointer can travel to it. */
const HIDE_DELAY_MS = 380;
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
 * hover a world to show its card, click to pin it.
 */
@Component({
  selector: 'app-orrery-canvas',
  template: '<canvas #canvas aria-label="Orrery of every project"></canvas>',
  styleUrl: './orrery-canvas.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.over]': 'isOverWorld',
    '[class.dragging]': 'press !== null',
    '(document:keydown)': 'onKey($event)',
  },
})
export class OrreryCanvas {
  readonly worlds = input.required<readonly OrreryWorld[]>();
  /** The repository of the world whose card is shown, or null. */
  readonly selected = model<string | null>(null);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly document = inject(DOCUMENT);
  private readonly motion = inject(MotionPreference);
  private readonly errors = inject(ErrorHandler);
  private readonly camera = new OrreryCamera();
  private readonly teardown: (() => void)[] = [];
  private scene: OrreryScene | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private loop: FrameLoop | null = null;
  private view: Viewport = { width: 0, height: 0 };
  private drawn: DrawnWorld[] = [];
  private shownAt: number | null = null;
  private lastWall: number | null = null;
  private pointer: { x: number; y: number } | null = null;
  private pinned: string | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private pinch: number | null = null;
  protected press: Press | null = null;
  protected isOverWorld = false;

  constructor() {
    effect(() => {
      const worlds = this.worlds();
      this.scene?.setWorlds(worlds);
      if (worlds.length && this.shownAt === null) this.showSystem();
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
    this.cancelHide();
  }

  /** The pointer left the card: let it go, unless it was pinned. */
  releaseCard(): void {
    if (!this.pinned) this.hideSoon();
  }

  private start(): void {
    const canvas = this.canvas().nativeElement;
    this.context = canvas.getContext('2d');
    if (!this.context) return;
    this.scene = new OrreryScene(this.document, readOrreryPalette(canvas));
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
  }

  private showSystem(): void {
    this.shownAt = performance.now() / 1000;
    if (!this.view.width) return;
    this.camera.fit(outermostOrbit(this.worlds()), this.view);
    this.camera.settle();
  }

  private draw(time: number, wall: number): void {
    const ctx = this.context;
    if (!ctx || !this.scene) return;
    const dt = this.lastWall === null ? 0 : Math.min(wall - this.lastWall, 0.1);
    this.lastWall = wall;
    const isStill = this.motion.isStill();
    if (isStill) this.camera.settle();
    else this.camera.advance(dt, this.press !== null);

    const ratio = this.pixelRatio();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, this.view.width, this.view.height);
    this.drawn = this.scene.draw(ctx, {
      view: this.view,
      camera: this.camera,
      time,
      sinceShown: isStill || this.shownAt === null ? FULLY_GROWN_S : wall - this.shownAt,
      isStill,
      selectedKey: this.selected(),
    });
    // Worlds move under a still pointer, so what it rests on can change.
    if (this.pointer && !this.press) this.hoverAt(this.pointer.x, this.pointer.y);
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
    on('pointercancel', () => (this.press = null));
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
    if (wasClick) {
      this.camera.stopDrift();
      this.clickAt(event.clientX, event.clientY);
    }
    this.loop?.kick();
  }

  private onPointerLeave(): void {
    this.pointer = null;
    this.isOverWorld = false;
    if (!this.pinned) this.hideSoon();
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
    this.isOverWorld = key !== null;
    if (key) {
      this.cancelHide();
      if (key !== this.selected() && !this.pinned) this.selected.set(key);
    } else if (this.selected() && !this.pinned) {
      this.hideSoon();
    }
  }

  /** A click pins the world's card; a click on empty sky clears it. */
  private clickAt(x: number, y: number): void {
    const key = pickWorld(this.drawn, x, y);
    this.cancelHide();
    this.pinned = key;
    this.selected.set(key);
  }

  /** Started once; a hide already pending is left to run, not restarted each frame. */
  private hideSoon(): void {
    if (this.hideTimer) return;
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (!this.pinned) this.selected.set(null);
    }, HIDE_DELAY_MS);
  }

  private cancelHide(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  private stop(): void {
    this.loop?.stop();
    this.cancelHide();
    for (const undo of this.teardown) undo();
  }
}
