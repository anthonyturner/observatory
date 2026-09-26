import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranscriptEntry } from '../../../../core/runs/transcript/transcript.types';
import { TranscriptRow } from '../transcript-row/transcript-row';

/** Entries kept on screen; older ones fold behind Show earlier. */
export const ENTRIES_SHOWN = 500;

/** A run read as a transcript: quiet mono lines for what Claude Code does
 *  around the task, the model's own words in the body face, a row per tool,
 *  and the verdict. */
@Component({
  selector: 'app-run-transcript',
  imports: [TranscriptRow],
  templateUrl: './run-transcript.html',
  styleUrl: './run-transcript.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunTranscript {
  readonly entries = input.required<readonly TranscriptEntry[]>();

  protected readonly isWhole = signal(false);
  protected readonly earlier = computed(() =>
    this.isWhole() ? 0 : Math.max(0, this.entries().length - ENTRIES_SHOWN),
  );
  protected readonly shown = computed(() => this.entries().slice(this.earlier()));
}
