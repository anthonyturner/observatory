import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReplyChip } from '../../../core/assistant/reply-chip';

/** The line over a reply: its tier as pips, and how it was reached. */
@Component({
  selector: 'app-reply-chip',
  templateUrl: './reply-chip.html',
  styleUrl: './reply-chip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-tone]': 'chip().tone' },
})
export class ReplyChipLine {
  readonly chip = input.required<ReplyChip>();
}
