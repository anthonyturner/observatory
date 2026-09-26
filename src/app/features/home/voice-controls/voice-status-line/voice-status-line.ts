import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  input,
  output,
  viewChildren,
} from '@angular/core';
import { StatusAction, StatusLine } from '../../../../core/voice/voice-status';

/** The voice block's status line: what voice is doing or why it cannot,
 *  with a progress bar while a model downloads and buttons when it asks. */
@Component({
  selector: 'app-voice-status-line',
  templateUrl: './voice-status-line.html',
  styleUrl: './voice-status-line.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.trouble]': 'line()?.isTrouble',
    '[class.empty]': '!words()',
  },
})
export class VoiceStatusLine {
  readonly line = input.required<StatusLine | null>();
  /** What it says when nothing else needs saying. */
  readonly resting = input.required<string>();
  readonly acted = output<StatusAction>();

  private readonly actionButtons = viewChildren<ElementRef<HTMLButtonElement>>('action');

  protected readonly words = computed(() => this.line()?.words ?? this.resting());

  constructor() {
    // A question asked in answer to a press takes the focus; one that comes
    // unasked leaves it where it is.
    afterRenderEffect(() => {
      if (this.line()?.takesFocus) this.actionButtons()[0]?.nativeElement.focus();
    });
  }
}
