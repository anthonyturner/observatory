import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** Where a save stands: not yet, on its way, answered, or not reached. */
export type SaveState = 'idle' | 'saving' | 'sent' | 'failed';

const SAVE_LABEL: Readonly<Record<SaveState, string>> = {
  idle: 'Save to GitHub',
  saving: 'Saving…',
  sent: 'Sent',
  failed: 'Could not save — retry',
};

/** The bar along the Edit tab's foot: what is about to be sent, and the two buttons. */
@Component({
  selector: 'app-sheet-savebar',
  templateUrl: './sheet-savebar.html',
  styleUrl: './sheet-savebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetSavebar {
  readonly summary = input.required<string>();
  readonly canSave = input.required<boolean>();
  /** Whether there is a badge to clear. */
  readonly canClear = input.required<boolean>();
  readonly saveState = input.required<SaveState>();
  readonly save = output<void>();
  readonly clear = output<void>();

  protected readonly saveLabel = computed(() => SAVE_LABEL[this.saveState()]);
  protected readonly saveDisabled = computed(
    () => !this.canSave() || this.saveState() === 'saving' || this.saveState() === 'sent',
  );
}
