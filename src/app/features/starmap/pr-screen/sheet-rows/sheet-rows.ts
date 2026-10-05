import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  input,
  output,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SheetRow } from './sheet-row';

/**
 * A list of files, commits or checks, one line each, with a note above it or
 * in its place. Given a `detail` template, each line is a button that opens
 * that template beneath it.
 */
@Component({
  selector: 'app-sheet-rows',
  imports: [NgTemplateOutlet],
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
  /** Drawn beneath the open line; without it, the lines cannot be opened. */
  readonly detail = input<TemplateRef<unknown> | null>(null);
  /** The key of the line whose detail is open. */
  readonly openKey = input<string | null>(null);
  /** A line was clicked to open or close, by its key. */
  readonly toggled = output<string>();

  protected readonly views = computed(() =>
    this.rows().map((row) => ({
      row,
      isOpen: row.key === this.openKey(),
      detailId: `row-detail-${row.key}`,
    })),
  );
}
