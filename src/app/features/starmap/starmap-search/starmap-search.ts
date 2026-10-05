import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { suggestionsFor } from '../sky-search';

/** How many suggestions the list shows at once. */
const SHOWN = 8;

/**
 * The review queue's search: a pull request or issue by title or number, with
 * its own suggestion list, which the browser's native one cannot be styled
 * like and pops up on hover.
 */
@Component({
  selector: 'app-starmap-search',
  host: { '(mouseleave)': 'close()' },
  templateUrl: './starmap-search.html',
  styleUrl: './starmap-search.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarmapSearch {
  readonly suggestions = input<readonly string[]>([]);
  /** Said beside the box when the last search found nothing. */
  readonly miss = input<string | null>(null);
  readonly find = output<string>();

  protected readonly query = signal('');
  protected readonly isOpen = signal(false);
  /** The suggestion the arrow keys are on, or -1. */
  protected readonly active = signal(-1);
  protected readonly shown = computed(() =>
    suggestionsFor(this.suggestions(), this.query(), SHOWN),
  );
  protected readonly expanded = computed(() => this.isOpen() && this.shown().length > 0);

  protected open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.active.set(-1);
  }

  protected type(value: string): void {
    this.query.set(value);
    this.active.set(-1);
    this.open();
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.shown().length;
    if (event.key === 'Escape' && this.expanded()) {
      event.stopPropagation();
      this.close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.isOpen()) return this.open();
      if (!count) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.active.update((index) => (index + step + count) % count);
    } else if (event.key === 'Enter' && this.expanded() && this.active() >= 0) {
      event.preventDefault();
      this.pick(this.shown()[this.active()]);
    }
  }

  protected pick(suggestion: string): void {
    this.query.set(suggestion);
    this.close();
    this.find.emit(suggestion);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.close();
    if (this.query().trim()) this.find.emit(this.query());
  }
}
