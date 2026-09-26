import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { CLIPBOARD_WRITER } from '../../core/clipboard/clipboard-writer';

/** How long Copied, or the fallback's hint, shows before the label returns. */
const CONFIRM_MS = 2400;
const COPIED = 'Copied';
const COPY_BY_KEY = 'Press Ctrl+C to copy';

/** Copies `text`. Where the browser refuses the clipboard (an insecure origin,
 *  or permission), it selects `selectTarget` instead, so a key press copies it. */
@Component({
  selector: 'app-copy-button',
  template: `<button type="button" class="abtn" [class.go]="isPrimary()" (click)="copy()">
    {{ shown() ?? label() }}
  </button>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopyButton {
  readonly text = input.required<string>();
  readonly label = input('Copy');
  readonly selectTarget = input<HTMLElement | null>(null);
  /** The proposal's copy is the button to press. */
  readonly isPrimary = input(false);

  private readonly clipboard = inject(CLIPBOARD_WRITER);
  private readonly document = inject(DOCUMENT);
  private readonly confirmation = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected readonly shown = this.confirmation.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected copy(): void {
    this.clipboard.write(this.text()).then(
      () => this.confirm(COPIED),
      () => {
        this.selectText();
        this.confirm(COPY_BY_KEY);
      },
    );
  }

  private selectText(): void {
    const target = this.selectTarget();
    const selection = this.document.getSelection();
    if (!target || !selection) return;
    const range = this.document.createRange();
    range.selectNodeContents(target);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private confirm(words: string): void {
    clearTimeout(this.timer);
    this.confirmation.set(words);
    this.timer = setTimeout(() => this.confirmation.set(null), CONFIRM_MS);
  }
}
