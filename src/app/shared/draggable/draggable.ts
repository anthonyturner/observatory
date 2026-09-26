import {
  DOCUMENT,
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  inject,
  input,
} from '@angular/core';

/** Where a dragged window was left, per viewer and per kind of window. */
interface Place {
  readonly x: number;
  readonly y: number;
}

const HANDLE = '[data-handle]';
const INTERACTIVE = 'button, a, input, select, textarea';
const PHONE = '(max-width: 720px)';
const EDGE = 8;
const TITLE_ROOM = 48;

/**
 * pr-starmap's movable windows: drag one by its `[data-handle]` and it stays
 * where it was left, remembered per kind of window so a card stops landing on
 * the stars you are looking at. Double-click the handle to put it back. Off on
 * a phone, where the window docks to the bottom.
 */
@Directive({ selector: '[appDraggable]' })
export class Draggable {
  /** The storage key its place is remembered under. */
  readonly appDraggable = input.required<string>();

  private readonly element: HTMLElement = inject(ElementRef).nativeElement;
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly listeners: (() => void)[] = [];
  private start: { id: number; dx: number; dy: number } | null = null;

  constructor() {
    afterNextRender(() => this.attach());
    inject(DestroyRef).onDestroy(() => this.listeners.forEach((remove) => remove()));
  }

  private attach(): void {
    const handle = this.element.querySelector<HTMLElement>(HANDLE);
    if (!handle || this.window?.matchMedia?.(PHONE).matches) return;
    const saved = this.read();
    // Wait a frame so the window has its real size before it is clamped.
    if (saved) this.window?.requestAnimationFrame(() => this.place(saved.x, saved.y));

    this.on(handle, 'pointerdown', (e) => {
      if (e.button !== 0 || (e.target as Element).closest(INTERACTIVE)) return;
      const r = this.element.getBoundingClientRect();
      this.start = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
      handle.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    this.on(handle, 'pointermove', (e) => {
      if (!this.start || this.start.id !== e.pointerId) return;
      this.place(e.clientX - this.start.dx, e.clientY - this.start.dy);
    });
    const end = (e: PointerEvent): void => {
      if (!this.start || this.start.id !== e.pointerId) return;
      this.start = null;
      const r = this.element.getBoundingClientRect();
      this.write({ x: r.left, y: r.top });
    };
    this.on(handle, 'pointerup', end);
    this.on(handle, 'pointercancel', end);
    this.on(handle, 'dblclick', (e) => {
      if ((e.target as Element).closest(INTERACTIVE)) return;
      this.element.classList.remove('dragged');
      this.element.style.left = '';
      this.element.style.top = '';
      this.write(null);
    });
  }

  private on<K extends 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel' | 'dblclick'>(
    target: HTMLElement,
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
  ): void {
    target.addEventListener(type, handler);
    this.listeners.push(() => target.removeEventListener(type, handler));
  }

  /** Placed by left and top alone, clamped so the title stays reachable. */
  private place(x: number, y: number): void {
    const width = this.window?.innerWidth ?? 0;
    const height = this.window?.innerHeight ?? 0;
    const r = this.element.getBoundingClientRect();
    const cx = Math.min(Math.max(EDGE, x), width - Math.min(r.width, width - 16) - EDGE);
    const cy = Math.min(Math.max(EDGE, y), height - TITLE_ROOM);
    this.element.classList.add('dragged');
    this.element.style.left = `${cx}px`;
    this.element.style.top = `${cy}px`;
  }

  private read(): Place | null {
    try {
      const saved = JSON.parse(localStorage.getItem(this.appDraggable()) ?? 'null') as Place | null;
      return saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : null;
    } catch {
      return null;
    }
  }

  private write(place: Place | null): void {
    try {
      if (place) localStorage.setItem(this.appDraggable(), JSON.stringify(place));
      else localStorage.removeItem(this.appDraggable());
    } catch {
      // Blocked storage: it opens in its default place.
    }
  }
}
