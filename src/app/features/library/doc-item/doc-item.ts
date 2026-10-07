import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DocListItem } from '../../../core/library/doc.types';
import { DocSpans } from '../doc-spans/doc-spans';

/** One list item's own line, with a task's box. */
@Component({
  selector: 'app-doc-item',
  imports: [DocSpans],
  template: `@let entry = item();
    @if (entry.checked !== null) {
      <span class="box" role="img" [attr.aria-label]="entry.checked ? 'Done' : 'To do'">{{
        entry.checked ? '☑' : '☐'
      }}</span>
    }
    <app-doc-spans [spans]="entry.spans" />`,
  styleUrl: './doc-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocItem {
  readonly item = input.required<DocListItem>();
}
