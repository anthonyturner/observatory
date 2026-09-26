import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SheetRow } from './sheet-row';

/** A list of files, commits or checks, one line each, with a note above it or in its place. */
@Component({
  selector: 'app-sheet-rows',
  templateUrl: './sheet-rows.html',
  styleUrl: './sheet-rows.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetRows {
  readonly rows = input.required<readonly SheetRow[]>();
  /** Said above the list. */
  readonly note = input<string | null>(null);
  /** Said instead of an empty list; null shows the empty list. */
  readonly empty = input<string | null>(null);
}
