import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { EntryAction, ReplyEntry } from '../../../core/assistant/reply-entry';
import { ReplyEntryCard } from '../reply-entry/reply-entry';

/** A button pressed under the reply numbered `entryId`. */
export interface EntryPress {
  readonly entryId: number;
  readonly action: EntryAction;
}

/** Replies, newest first. */
@Component({
  selector: 'app-reply-list',
  imports: [ReplyEntryCard],
  templateUrl: './reply-list.html',
  styleUrl: './reply-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplyList {
  readonly entries = input.required<readonly ReplyEntry[]>();
  /** The reply being read aloud, if any. */
  readonly speakingId = input<number | null>(null);
  readonly pressed = output<EntryPress>();
  readonly stopSpeaking = output<void>();
  readonly followed = output<string>();
}
