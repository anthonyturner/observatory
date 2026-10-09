import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  model,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { IndexShelf } from '../library-page/library-view';

/** How far each key moves the focus through the index's pages. */
const KEY_STEPS: Readonly<Record<string, (at: number, last: number) => number>> = {
  ArrowDown: (at, last) => Math.min(at + 1, last),
  ArrowUp: (at) => Math.max(at - 1, 0),
  Home: () => 0,
  End: (_, last) => last,
};
const PAGE_LINKS = 'a[data-page]';

/**
 * The Library's pages as a star chart: each shelf a constellation, each page
 * a star sized by its length, the open page lit. Search narrows it by title
 * and text; the arrow keys walk it. The Guide draws its contents with it too.
 */
@Component({
  selector: 'app-library-index',
  imports: [RouterLink],
  templateUrl: './library-index.html',
  styleUrl: './library-index.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.still]': 'isStill()' },
})
export class LibraryIndex {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly shelves = input.required<readonly IndexShelf[]>();
  /** What a search found, said aloud; null with no search. */
  readonly resultLine = input.required<string | null>();
  /** True when motion is off, so the open page's star holds still. */
  readonly isStill = input.required<boolean>();
  readonly query = model.required<string>();
  /** The search box's label, and the list's name, for what the entries are. */
  readonly searchLabel = input('Search pages');
  readonly listLabel = input('Pages');

  protected search(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.query.set(event.target.value);
  }

  protected walk(event: KeyboardEvent): void {
    const step = KEY_STEPS[event.key];
    if (!step || !(event.target instanceof HTMLElement)) return;
    const links = [...this.host.nativeElement.querySelectorAll<HTMLElement>(PAGE_LINKS)];
    const at = links.indexOf(event.target);
    if (at === -1) return;
    event.preventDefault();
    links[step(at, links.length - 1)]?.focus();
  }
}
