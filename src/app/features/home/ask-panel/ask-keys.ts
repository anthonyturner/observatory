import { DOCUMENT, DestroyRef, Directive, inject } from '@angular/core';
import { AskBoxFocus } from '../../../core/assistant/ask-box-focus';
import { AskFeed } from '../../../core/assistant/ask-feed';
import { PushToTalk } from '../../../core/voice/push-to-talk';

const TEXT_ENTRY = 'input, textarea, select, [contenteditable]';

/** The Ask box's page keys: / goes to the box, and Esc takes Stay here while
 *  a page jump waits. Esc during a recording is voice's, to throw it away, so
 *  it is only marked used here. Keys typed into a field belong to the field.
 *  It listens as the key travels down, so it acts before voice's own Esc,
 *  which would otherwise cut the jump's spoken line short and let it land. */
@Directive({ selector: '[appAskKeys]' })
export class AskKeys {
  private readonly focus = inject(AskBoxFocus);
  private readonly feed = inject(AskFeed);
  private readonly talk = inject(PushToTalk);

  constructor() {
    const document = inject(DOCUMENT);
    const onKeydown = (event: KeyboardEvent): void => this.onKeydown(event);
    document.addEventListener('keydown', onKeydown, { capture: true });
    inject(DestroyRef).onDestroy(() =>
      document.removeEventListener('keydown', onKeydown, { capture: true }),
    );
  }

  private onKeydown(event: KeyboardEvent): void {
    if (isTyping(event)) return;
    if (isSlash(event)) {
      event.preventDefault();
      this.focus.request();
    } else if (event.key === 'Escape') {
      this.escape(event);
    }
  }

  private escape(event: KeyboardEvent): void {
    if (this.talk.isRecording()) {
      event.preventDefault();
    } else if (this.feed.hasPendingJump()) {
      event.preventDefault();
      this.feed.stayHere();
    }
  }
}

function isSlash(event: KeyboardEvent): boolean {
  return event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey;
}

function isTyping(event: KeyboardEvent): boolean {
  return event.target instanceof Element && event.target.closest(TEXT_ENTRY) !== null;
}
