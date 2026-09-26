import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { EditBadge } from '../../../../core/edits/edit-badge';
import { SHEET_TABS, SheetTab, TAB_LABEL, TabCounts } from '../sheet-view';
import { Route } from '../sheet-view';
import { SheetStatus } from '../sheet-status/sheet-status';

/** What the header needs to know about the screen's state. */
export interface HeaderState {
  /** The route line, or null while it is being read or when it could not be. */
  readonly route: Route | null;
  readonly loading: boolean;
  readonly fetching: boolean;
  readonly badge: EditBadge | null;
  readonly hasNewer: boolean;
  readonly counts: TabCounts;
}

/** The PR screen's header, which also moves the window: the bucket, the title,
 *  the route, how the last edit went, and the tabs. */
@Component({
  selector: 'app-sheet-header',
  imports: [SheetStatus],
  templateUrl: './sheet-header.html',
  styleUrl: './sheet-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetHeader {
  readonly kicker = input.required<string>();
  readonly number = input.required<number>();
  readonly title = input.required<string>();
  readonly url = input.required<string>();
  readonly state = input.required<HeaderState>();
  readonly tab = input.required<SheetTab>();
  readonly tabChange = output<SheetTab>();
  readonly refresh = output<void>();
  readonly closed = output<void>();
  readonly showNewer = output<void>();

  protected readonly tabs = SHEET_TABS;
  protected readonly tabLabel = TAB_LABEL;
}
