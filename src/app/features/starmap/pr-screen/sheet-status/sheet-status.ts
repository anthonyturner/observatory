import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { EditBadge } from '../../../../core/edits/edit-badge';

/** The line under the title: how the last edit went, and a button when newer details wait. */
@Component({
  selector: 'app-sheet-status',
  templateUrl: './sheet-status.html',
  styleUrl: './sheet-status.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetStatus {
  readonly badge = input<EditBadge | null>(null);
  readonly hasNewer = input(false);
  readonly showNewer = output<void>();
}
