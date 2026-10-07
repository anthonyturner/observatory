import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SheetMarkdown } from '../../starmap/pr-screen/sheet-markdown/sheet-markdown';
import { ReleaseDetail } from './release-detail-view';

/** One release, or the Unreleased work: its notes and the merged pull requests it shipped, each linked. */
@Component({
  selector: 'app-release-detail',
  imports: [SheetMarkdown],
  templateUrl: './release-detail.html',
  styleUrl: './release-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReleaseDetailPanel {
  readonly detail = input.required<ReleaseDetail>();
}
