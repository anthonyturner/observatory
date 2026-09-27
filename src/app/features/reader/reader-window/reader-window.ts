import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Reader } from '../../../core/reader/reader-service';

type View = 'reader' | 'page';

/** How far the window keeps from the screen's edges when dragged. */
const EDGE_PX = 8;
/** The title bar stays on screen, so the window can always be dragged back. */
const KEEP_BAR_PX = 40;

/** A floating window over the dashboard that shows a page Jev cited: its
 *  readable text by default, the live page where the site allows it, and
 *  always a way out to the browser. Drag it by its title bar, resize it from
 *  its corner, close it with × or Esc. */
@Component({
  selector: 'app-reader-window',
  templateUrl: './reader-window.html',
  styleUrl: './reader-window.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'closeIfOpen()',
  },
})
export class ReaderWindow {
  protected readonly reader = inject(Reader);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly document = inject(DOCUMENT);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  /** Where focus was before the window opened, to go back to on close. */
  private returnFocus: HTMLElement | null = null;
  private drag: {
    pointer: number;
    fromX: number;
    fromY: number;
    left: number;
    top: number;
  } | null = null;

  protected readonly view = signal<View>('reader');
  /** Where the window sits once dragged; null keeps it at its starting place. */
  protected readonly position = signal<{ left: number; top: number } | null>(null);

  protected readonly state = this.reader.state;
  protected readonly ready = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.page : null;
  });
  /** The live page, framed and sandboxed, only for a site that allows it. */
  protected readonly frameUrl = computed((): SafeResourceUrl | null => {
    const page = this.ready();
    if (!page?.canEmbed || !/^https?:\/\//.test(page.url)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(page.url);
  });
  protected readonly publishedOn = computed(() => {
    const published = this.ready()?.published;
    const date = published ? new Date(published) : null;
    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
      : null;
  });

  constructor() {
    effect(() => {
      const status = this.state().status;
      untracked(() => (status === 'closed' ? this.restoreFocus() : this.takeFocus()));
    });
  }

  protected close(): void {
    this.reader.close();
    this.view.set('reader');
  }

  protected closeIfOpen(): void {
    if (this.state().status !== 'closed') this.close();
  }

  protected startDrag(event: PointerEvent): void {
    const panel = this.panel()?.nativeElement;
    const onControl = event.target instanceof Element && event.target.closest('button, a');
    if (!panel || event.button !== 0 || onControl) return;
    const box = panel.getBoundingClientRect();
    this.drag = {
      pointer: event.pointerId,
      fromX: event.clientX,
      fromY: event.clientY,
      left: box.left,
      top: box.top,
    };
    if (event.currentTarget instanceof Element)
      event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  protected moveDrag(event: PointerEvent): void {
    const drag = this.drag;
    const panel = this.panel()?.nativeElement;
    if (!drag || !panel || event.pointerId !== drag.pointer) return;
    const view = this.document.defaultView;
    if (!view) return;
    const maxLeft = view.innerWidth - panel.offsetWidth - EDGE_PX;
    const maxTop = view.innerHeight - KEEP_BAR_PX;
    this.position.set({
      left: Math.min(
        Math.max(EDGE_PX, drag.left + event.clientX - drag.fromX),
        Math.max(EDGE_PX, maxLeft),
      ),
      top: Math.min(Math.max(EDGE_PX, drag.top + event.clientY - drag.fromY), maxTop),
    });
  }

  protected endDrag(): void {
    this.drag = null;
  }

  private takeFocus(): void {
    const active = this.document.activeElement;
    if (!this.returnFocus && active instanceof HTMLElement) {
      this.returnFocus = active;
    }
    queueMicrotask(() => this.closeButton()?.nativeElement.focus());
  }

  private restoreFocus(): void {
    this.returnFocus?.focus();
    this.returnFocus = null;
  }
}
