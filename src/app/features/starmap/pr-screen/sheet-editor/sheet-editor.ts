import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EditForm,
  canSave,
  changeSummary,
  formChanges,
  formOf,
} from '../../../../core/edits/edit-changes';
import { PullEdits } from '../../../../core/edits/pull-edits';
import { PullDetail } from '../../../../core/queue/pull-detail';
import { SaveState, SheetSavebar } from '../sheet-savebar/sheet-savebar';
import { labelColour } from '../sheet-view';

/**
 * The Edit tab: title, description, labels, assignees and reviewers. Merging
 * and marking ready live in the merge box. What it shows is GitHub's state;
 * saving sends only what differs, and a new set of details starts the form again.
 */
@Component({
  selector: 'app-sheet-editor',
  imports: [SheetSavebar],
  templateUrl: './sheet-editor.html',
  styleUrl: './sheet-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetEditor {
  readonly detail = input.required<PullDetail>();
  /** GitHub took an edit: the details should be read again. */
  readonly saved = output<void>();

  private readonly edits = inject(PullEdits);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = linkedSignal<PullDetail, EditForm>({
    source: this.detail,
    computation: formOf,
  });
  protected readonly saveState = linkedSignal<PullDetail, SaveState>({
    source: this.detail,
    computation: () => 'idle',
  });
  private readonly asked = computed(() => formChanges(this.form(), this.detail()));
  protected readonly summary = computed(() => changeSummary(this.asked()));
  protected readonly canSave = computed(() => canSave(this.asked()));
  protected readonly titleChanged = computed(() => this.asked().title !== undefined);
  protected readonly bodyChanged = computed(() => this.asked().body !== undefined);
  protected readonly hasRecord = this.edits.hasRecord;
  /** The repository's labels when known, else the pull request's own, each pressed or not. */
  protected readonly chips = computed(() => {
    const known = this.edits.labels();
    const offered = known.length ? known : this.detail().labels;
    const pressed = this.form().labels;
    return offered.map((label) => ({
      name: label.name,
      colour: labelColour(label.color),
      pressed: pressed.has(label.name),
    }));
  });

  protected change(patch: Partial<EditForm>): void {
    this.form.update((form) => ({ ...form, ...patch }));
    if (this.saveState() === 'sent') this.saveState.set('idle');
  }

  protected toggleLabel(name: string): void {
    const labels = new Set(this.form().labels);
    if (!labels.delete(name)) labels.add(name);
    this.change({ labels });
  }

  protected save(): void {
    this.saveState.set('saving');
    this.edits
      .save(this.asked())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sent) => {
        this.saveState.set(sent ? 'sent' : 'failed');
        if (sent) this.saved.emit();
      });
  }

  protected clear(): void {
    this.edits.clear();
  }
}
