import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ROW_MARKS } from '../../../../core/runs/transcript/tool-words';
import { FoldEntry } from '../../../../core/runs/transcript/transcript.types';
import { DetailBlockView } from '../detail-block/detail-block';

/** One row of the transcript that opens for more: a tool's call and result,
 *  the hooks, or an event. A tool the owner's settings refused is framed
 *  warm, as a decision of theirs to know about, not a fault. */
@Component({
  selector: 'app-transcript-row',
  imports: [DetailBlockView],
  templateUrl: './transcript-row.html',
  styleUrl: './transcript-row.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-status]': 'fold().status',
    '[class.plain]': 'fold().isPlain',
    '[class.nested]': 'fold().isNested',
    '[class.refused]': 'isRefused()',
    '[class.expected]': 'fold().refusal?.isExpected',
  },
})
export class TranscriptRow {
  readonly fold = input.required<FoldEntry>();

  protected readonly isOpen = signal(false);
  protected readonly mark = computed(() => ROW_MARKS[this.fold().status].mark);
  /** What a screen reader hears after the row's name: ", worked". */
  protected readonly said = computed(() => {
    const said = ROW_MARKS[this.fold().status].said;
    return said ? `, ${said}` : '';
  });
  protected readonly isRefused = computed(() => this.fold().refusal?.isExpected === false);
}
