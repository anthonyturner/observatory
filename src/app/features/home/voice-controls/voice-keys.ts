import { Directive, ErrorHandler, inject } from '@angular/core';
import { PushToTalk } from '../../../core/voice/push-to-talk';
import { REPLY_VOICE } from '../../../core/voice/reply-voice';

const TEXT_ENTRY = 'input, textarea, select, [contenteditable]';

/** Voice's keys: held M talks, and Esc throws a recording away or, with
 *  none, stops a reply. Keys typed into a field belong to the field. */
@Directive({
  selector: '[appVoiceKeys]',
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(document:keyup)': 'onKeyup($event)',
    '(window:blur)': 'talk.release()',
  },
})
export class VoiceKeys {
  protected readonly talk = inject(PushToTalk);
  private readonly replyVoice = inject(REPLY_VOICE);
  private readonly errors = inject(ErrorHandler);

  protected onKeydown(event: KeyboardEvent): void {
    if (isTyping(event)) return;
    if (isTalkKey(event)) {
      event.preventDefault();
      // A held key repeats; only its first press counts.
      if (!event.repeat) {
        this.talk.press('hold').catch((error: unknown) => this.errors.handleError(error));
      }
    } else if (event.key === 'Escape' && !this.talk.discard()) {
      this.replyVoice.stop();
    }
  }

  protected onKeyup(event: KeyboardEvent): void {
    if (isM(event)) this.talk.release();
  }
}

function isM(event: KeyboardEvent): boolean {
  return event.key?.toLowerCase() === 'm' || event.code === 'KeyM';
}

function isTalkKey(event: KeyboardEvent): boolean {
  return isM(event) && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}

function isTyping(event: KeyboardEvent): boolean {
  return event.target instanceof Element && event.target.closest(TEXT_ENTRY) !== null;
}
