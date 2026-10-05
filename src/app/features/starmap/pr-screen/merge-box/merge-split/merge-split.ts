import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { MERGE_METHODS, MergeMethod } from '../../../../../core/edits/edit-record';
import { METHOD_WORDS } from '../merge-words';

/** Where each key moves the menu's focus, given where it is and how many items there are. */
const MOVES: Readonly<Record<string, (index: number, count: number) => number>> = {
  ArrowDown: (index, count) => (index + 1) % count,
  ArrowUp: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
};
const OPENERS = new Set(['ArrowDown', 'ArrowUp']);

let menus = 0;

/**
 * GitHub's split merge button: the main half merges with the chosen method,
 * the arrow opens a menu of the other ways. The menu follows the WAI-ARIA
 * menu-button pattern: arrows move, Escape closes and returns focus.
 */
@Component({
  selector: 'app-merge-split',
  templateUrl: './merge-split.html',
  styleUrl: './merge-split.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'closeOutside($event)' },
})
export class MergeSplit {
  readonly method = input.required<MergeMethod>();
  /** The main half only: a method can still be chosen while merging is held back. */
  readonly disabled = input(false);
  readonly press = output<void>();
  readonly pick = output<MergeMethod>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly main = viewChild.required<ElementRef<HTMLButtonElement>>('main');
  private readonly caret = viewChild.required<ElementRef<HTMLButtonElement>>('caret');
  private readonly items = viewChildren<ElementRef<HTMLButtonElement>>('item');

  protected readonly menuId = `merge-menu-${++menus}`;
  protected readonly isOpen = signal(false);
  protected readonly active = signal(0);
  protected readonly words = computed(() => METHOD_WORDS[this.method()]);
  protected readonly choices = computed(() =>
    MERGE_METHODS.map((method) => ({
      method,
      words: METHOD_WORDS[method],
      isChecked: method === this.method(),
    })),
  );
  private readonly checkedIndex = computed(() => MERGE_METHODS.indexOf(this.method()));

  constructor() {
    afterRenderEffect(() => {
      if (this.isOpen()) this.items()[this.active()]?.nativeElement.focus();
    });
  }

  /** Focus the main half, or the arrow while the main half is disabled. */
  focusMain(): void {
    (this.disabled() ? this.caret() : this.main()).nativeElement.focus();
  }

  protected toggle(): void {
    if (this.isOpen()) this.isOpen.set(false);
    else this.openAt(this.checkedIndex());
  }

  protected onCaretKey(event: KeyboardEvent): void {
    if (!OPENERS.has(event.key)) return;
    event.preventDefault();
    this.openAt(event.key === 'ArrowUp' ? MERGE_METHODS.length - 1 : this.checkedIndex());
  }

  protected onMenuKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // The PR screen closes on Escape; here it closes only the menu.
      event.stopPropagation();
      this.closeToCaret();
      return;
    }
    if (event.key === 'Tab') {
      this.isOpen.set(false);
      return;
    }
    const move = MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    this.active.update((index) => move(index, MERGE_METHODS.length));
  }

  protected choose(method: MergeMethod): void {
    this.pick.emit(method);
    this.closeToCaret();
  }

  protected closeOutside(event: MouseEvent): void {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }

  private openAt(index: number): void {
    this.active.set(index);
    this.isOpen.set(true);
  }

  private closeToCaret(): void {
    this.isOpen.set(false);
    this.caret().nativeElement.focus();
  }
}
