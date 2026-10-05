import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** The review queue's search: a pull request or issue by title or number. */
@Component({
  selector: 'app-starmap-search',
  templateUrl: './starmap-search.html',
  styleUrl: './starmap-search.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarmapSearch {
  readonly suggestions = input<readonly string[]>([]);
  /** Said beside the box when the last search found nothing. */
  readonly miss = input<string | null>(null);
  readonly find = output<string>();

  protected submit(event: Event, query: string): void {
    event.preventDefault();
    if (query.trim()) this.find.emit(query);
  }
}
