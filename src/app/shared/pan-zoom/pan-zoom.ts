import {
  DestroyRef,
  Directive,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ELEMENT_SIZE } from '../element-size/element-size';
import {
  Area,
  Size,
  Viewport,
  fitViewport,
  panBy,
  recentred,
  resized,
  startViewport,
  svgTransformOf,
  zoomAt,
} from './viewport';

const MARGIN = 24;
const ZOOM_STEP = 1.25;
const WHEEL_SENSITIVITY = 0.0015;
const WHEEL_LINE_PIXELS = 16;
const KEY_PAN_PIXELS = 80;
/** A press that moves less than this is a click, not a drag. */
const DRAG_THRESHOLD = 4;

interface Drag {
  readonly pointer: number;
  readonly x: number;
  readonly y: number;
  readonly moved: boolean;
}

/**
 * Lets an SVG drawing be dragged, wheel-zoomed and keyed round inside the element it sits on.
 * Bind `transform()` on a `<g>` that wraps the drawing, and drop the SVG's viewBox: the drawing's
 * own units are pixels at scale 1. A new `appPanZoom` area keeps the zoom and centres the drawing.
 */
@Directive({
  selector: '[appPanZoom]',
  exportAs: 'panZoom',
  host: {
    tabindex: '0',
    class: 'pan-zoom',
    '[class.dragging]': 'drag()?.moved === true',
    '(wheel)': 'onWheel($event)',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerEnd($event)',
    '(pointercancel)': 'onPointerEnd($event)',
    '(keydown)': 'onKeyDown($event)',
  },
})
export class PanZoom {
  /** The stretch of the drawing that fitting shows whole. */
  readonly appPanZoom = input.required<Area>();

  private readonly frame: Element = inject(ElementRef).nativeElement;
  private readonly viewport = signal<Viewport | null>(null);
  private readonly size = signal<Size>({ width: 0, height: 0 });
  protected readonly drag = signal<Drag | null>(null);
  /** Set when a drag ends, so the click the browser sends after it does not pick what is under it. */
  private swallowClick = false;

  /** Hidden until the frame has a size, rather than flashing at the wrong place. */
  readonly transform = computed(() => {
    const viewport = this.viewport();
    return viewport ? svgTransformOf(viewport) : 'scale(0)';
  });

  constructor() {
    effect(() => {
      const area = this.appPanZoom();
      untracked(() => this.show(area));
    });

    inject(ELEMENT_SIZE)(this.frame)
      .pipe(takeUntilDestroyed())
      .subscribe((size) => this.measure(size));
    const onClick = (event: Event): void => {
      if (!this.swallowClick) return;
      this.swallowClick = false;
      event.stopPropagation();
    };
    this.frame.addEventListener('click', onClick, { capture: true });
    inject(DestroyRef).onDestroy(() =>
      this.frame.removeEventListener('click', onClick, { capture: true }),
    );
  }

  zoomIn(): void {
    this.zoomBy(ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomBy(1 / ZOOM_STEP);
  }

  /** Shows the whole drawing. */
  fit(): void {
    this.place(() => fitViewport(this.appPanZoom(), this.size(), MARGIN));
  }

  /** Back to the first look: readable and centred. */
  reset(): void {
    this.place(() => startViewport(this.appPanZoom(), this.size(), MARGIN));
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    const lines = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_PIXELS : 1;
    const rect = this.frame.getBoundingClientRect();
    const focus = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    this.move((v) => zoomAt(v, Math.exp(-event.deltaY * lines * WHEEL_SENSITIVITY), focus));
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.swallowClick = false;
    this.drag.set({ pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false });
  }

  protected onPointerMove(event: PointerEvent): void {
    const drag = this.drag();
    if (!drag || drag.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) this.frame.setPointerCapture?.(event.pointerId);
    this.drag.set({ pointer: drag.pointer, x: event.clientX, y: event.clientY, moved: true });
    this.move((v) => panBy(v, dx, dy));
  }

  protected onPointerEnd(event: PointerEvent): void {
    const drag = this.drag();
    if (!drag || drag.pointer !== event.pointerId) return;
    this.swallowClick = drag.moved;
    this.drag.set(null);
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const arrows: Readonly<Record<string, readonly [number, number]>> = {
      ArrowLeft: [KEY_PAN_PIXELS, 0],
      ArrowRight: [-KEY_PAN_PIXELS, 0],
      ArrowUp: [0, KEY_PAN_PIXELS],
      ArrowDown: [0, -KEY_PAN_PIXELS],
    };
    // Arrows pan only from the frame itself, so they never fight a focused control inside it.
    const pan = event.target === this.frame ? arrows[event.key] : undefined;
    if (pan) this.move((v) => panBy(v, pan[0], pan[1]));
    else if (event.key === '+' || event.key === '=') this.zoomIn();
    else if (event.key === '-' || event.key === '_') this.zoomOut();
    else if (event.key === '0') this.fit();
    else return;
    event.preventDefault();
  }

  private zoomBy(factor: number): void {
    const { width, height } = this.size();
    this.move((v) => zoomAt(v, factor, { x: width / 2, y: height / 2 }));
  }

  private show(area: Area): void {
    const current = this.viewport();
    if (current) this.viewport.set(recentred(current, area, this.size()));
    else this.place(() => startViewport(area, this.size(), MARGIN));
  }

  private measure(after: Size): void {
    const before = this.size();
    this.size.set(after);
    const current = this.viewport();
    if (current) this.viewport.set(resized(current, before, after));
    else this.reset();
  }

  /** Places the drawing once the frame has a size; until then the drawing stays hidden. */
  private place(next: () => Viewport): void {
    if (this.size().width > 0) this.viewport.set(next());
  }

  private move(change: (viewport: Viewport) => Viewport): void {
    const current = this.viewport();
    if (current) this.viewport.set(change(current));
  }
}
