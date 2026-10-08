import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { JournalCard } from '../journal-page/journal-view';

/** One lesson: the pull request it came from, the three steps of the redo, and the principles it taught. */
@Component({
  selector: 'app-journal-entry',
  templateUrl: './journal-entry.html',
  styleUrl: './journal-entry.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalEntryCard {
  readonly card = input.required<JournalCard>();
  /** The principle the list is narrowed to, so its chip reads as pressed. */
  readonly picked = input<string | null>(null);
  /** A principle's chip was pressed: the list narrows to it, or widens again. */
  readonly taught = output<string>();
}
