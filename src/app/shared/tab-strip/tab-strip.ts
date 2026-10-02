import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  viewChildren,
} from '@angular/core';

/** One tab: its name, and a short state beside it. */
export interface TabStripTab {
  readonly id: string;
  readonly label: string;
  /** Shown beside the label, and not read out: "3", "off", "failed"; empty for none. */
  readonly note: string;
  /** What a screen reader says after the label instead: ", 3 unread". */
  readonly spokenNote: string;
  readonly isBad: boolean;
}

/** The element id of tab `id` in the strip called `name`, for a panel's `aria-labelledby`. */
export const tabStripTabId = (name: string, id: string): string => `${name}-tab-${id}`;

/** The tab a key moves to from `index`, wrapping at the ends; null for any other key. */
export function tabIndexAfter(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count;
    case 'ArrowLeft':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/**
 * A row of tabs over one panel, as the WAI-ARIA tabs pattern has it: only the
 * selected tab is a tab stop, the arrow keys move along the row and wrap, Home
 * and End jump to the ends, and moving to a tab selects it.
 */
@Component({
  selector: 'app-tab-strip',
  templateUrl: './tab-strip.html',
  styleUrl: './tab-strip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabStrip {
  /** Prefixes each tab's id; see tabStripTabId. */
  readonly name = input.required<string>();
  readonly label = input.required<string>();
  readonly panelId = input.required<string>();
  readonly tabs = input.required<readonly TabStripTab[]>();
  readonly selected = input.required<string>();
  readonly selectedChange = output<string>();

  /** Each tab's element id, in tab order. */
  protected readonly tabIds = computed(() =>
    this.tabs().map((tab) => tabStripTabId(this.name(), tab.id)),
  );

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tab');

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const next = tabIndexAfter(event.key, index, this.tabs().length);
    if (next === null) return;
    event.preventDefault();
    this.selectedChange.emit(this.tabs()[next].id);
    this.buttons()[next]?.nativeElement.focus();
  }
}
