import {
  afterNextRender,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ELEMENT_SIZE } from '../element-size/element-size';

let disclosures = 0;

/**
 * The open and close behaviour of a drop-down that a button reveals, put on the
 * element that holds both: `<div [appDisclosure]="button"><button #button>…`.
 * The list closes on a press outside, when focus leaves the element, and on
 * Escape, which stops there so the page does not also close its top card and
 * hands focus back to the button. It also closes when the button is taken away
 * by a resize, which a hidden list is no use without.
 *
 * It sets no attributes: the template reads `isOpen()` and `panelId` for the
 * button's `aria-expanded` and `aria-controls` and the list's `id`.
 */
@Directive({
  selector: '[appDisclosure]',
  exportAs: 'appDisclosure',
  host: {
    '(document:pointerdown)': 'closeOutside($event)',
    '(keydown.escape)': 'closeOnEscape($event)',
    '(focusout)': 'closeWhenFocusLeaves($event)',
  },
})
export class Disclosure {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly open = signal(false);

  /** The button that reveals the list. */
  readonly trigger = input.required<HTMLElement>({ alias: 'appDisclosure' });
  /** Ties the button to its list. */
  readonly panelId = `disclosure-${++disclosures}`;
  readonly isOpen = this.open.asReadonly();

  constructor() {
    const sizeOf = inject(ELEMENT_SIZE);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() =>
      sizeOf(this.trigger())
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe(({ width, height }) => {
          if (!width && !height) this.open.set(false);
        }),
    );
  }

  /** Opening focuses the button, so Escape reaches the list even where a click does not focus. */
  toggle(): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.open.set(true);
    this.trigger().focus();
  }

  close(): void {
    this.open.set(false);
  }

  /** Closes after a choice, leaving focus on the button and not on a link that is now hidden. */
  closeToTrigger(): void {
    this.open.set(false);
    this.trigger().focus();
  }

  protected closeOnEscape(event: Event): void {
    if (!this.open()) return;
    event.stopPropagation();
    this.closeToTrigger();
  }

  protected closeOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  protected closeWhenFocusLeaves(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && !this.host.nativeElement.contains(next)) this.open.set(false);
  }
}
