import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { HeardWords } from '../../../core/assistant/ask-draft';

/** An input method still composing a word sends this key code for its Enter. */
const COMPOSING_KEY_CODE = 229;

/** The text box and Send. Enter sends and Shift+Enter starts a new line; the
 *  box grows with its words and is read-only while a request is on its way. */
@Component({
  selector: 'app-ask-bar',
  templateUrl: './ask-bar.html',
  styleUrl: './ask-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AskBar {
  readonly isBusy = input(false);
  /** Jev is off, so only app actions are matched. */
  readonly isKeywordsOnly = input(false);
  /** Each new value brings the focus back to the box. */
  readonly focusRequests = input(0);
  /** Words heard while sending them could be wrong: added to the box, not sent. */
  readonly heard = input<HeardWords | null>(null);
  readonly asked = output<string>();
  /** The box's words, whenever they change. */
  readonly edited = output<string>();
  /** Esc in the box, for the panel to cancel what it can. */
  readonly escaped = output<void>();

  private readonly box = viewChild.required<ElementRef<HTMLTextAreaElement>>('box');

  constructor() {
    effect(() => {
      if (this.focusRequests() > 0) untracked(() => this.box().nativeElement.focus());
    });
    effect(() => {
      const heard = this.heard();
      if (heard) untracked(() => this.takeIn(heard.words));
    });
  }

  blur(): void {
    this.box().nativeElement.blur();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.send();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (isSendKey(event)) {
      event.preventDefault();
      this.send();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.escaped.emit();
    }
  }

  protected onInput(): void {
    this.grow();
    this.edited.emit(this.box().nativeElement.value);
  }

  protected grow(): void {
    const box = this.box().nativeElement;
    box.style.height = 'auto';
    box.style.height = `${box.scrollHeight}px`;
  }

  private send(): void {
    const box = this.box().nativeElement;
    const text = box.value.trim();
    if (!text || this.isBusy()) return;
    box.value = '';
    this.grow();
    this.edited.emit('');
    this.asked.emit(text);
  }

  private takeIn(words: string): void {
    const box = this.box().nativeElement;
    box.value = [box.value.trim(), words].filter(Boolean).join(' ');
    this.grow();
    this.edited.emit(box.value);
  }
}

function isSendKey(event: KeyboardEvent): boolean {
  return (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.isComposing &&
    event.keyCode !== COMPOSING_KEY_CODE
  );
}
