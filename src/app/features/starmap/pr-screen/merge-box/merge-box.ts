import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EditChanges, EditRecord, MergeMethod } from '../../../../core/edits/edit-record';
import { MergeMethodChoice } from '../../../../core/edits/merge-method-choice';
import { PullEdits } from '../../../../core/edits/pull-edits';
import { PullDetail } from '../../../../core/queue/pull-detail';
import { mergeBoxOf } from './merge-box-view';
import { MergeSplit } from './merge-split/merge-split';
import { METHOD_WORDS } from './merge-words';

const SHORT_OID_LENGTH = 7;
const UNREACHABLE = 'The API could not be reached. Nothing was sent to GitHub.';

/** Whether GitHub did what one of the box's two buttons asked. */
type Outcome = (record: EditRecord | null) => boolean;
const MERGED: Outcome = (record) => Boolean(record?.mergedWith);
const READIED: Outcome = (record) => Boolean(record?.readiedAt);

/**
 * GitHub's merge box, on every tab of the PR screen: whether the pull request
 * can merge, a split button to merge it, and Ready for review for a draft.
 * Once it is merged or closed, the buttons are gone and nothing more is sent.
 */
@Component({
  selector: 'app-merge-box',
  imports: [MergeSplit],
  templateUrl: './merge-box.html',
  styleUrl: './merge-box.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'cancelOnEscape($event)' },
})
export class MergeBox {
  readonly detail = input.required<PullDetail>();
  /** GitHub took a merge or a ready: the details should be read again. */
  readonly saved = output<void>();

  private readonly edits = inject(PullEdits);
  private readonly choice = inject(MergeMethodChoice);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirmButton');
  private readonly split = viewChild(MergeSplit);
  private wasConfirming = false;

  protected readonly view = computed(() =>
    mergeBoxOf({ detail: this.detail(), record: this.edits.last() }),
  );
  protected readonly method = this.choice.chosen;
  protected readonly words = computed(() => METHOD_WORDS[this.method()]);
  protected readonly isSending = this.edits.isSending;
  protected readonly canMerge = computed(() => {
    const view = this.view();
    return !view.ending && !view.blockedBy && !this.isSending();
  });
  protected readonly confirming = linkedSignal<PullDetail, boolean>({
    source: this.detail,
    computation: () => false,
  });
  protected readonly problem = linkedSignal<PullDetail, string | null>({
    source: this.detail,
    computation: () => null,
  });
  protected readonly shortOid = computed(() => this.detail().headOid.slice(0, SHORT_OID_LENGTH));

  constructor() {
    afterRenderEffect(() => {
      const confirming = this.confirming();
      if (confirming) this.confirmButton()?.nativeElement.focus();
      else if (this.wasConfirming) this.split()?.focusMain();
      this.wasConfirming = confirming;
    });
  }

  protected pick(method: MergeMethod): void {
    this.choice.choose(method);
  }

  protected askToMerge(): void {
    if (!this.canMerge()) return;
    this.problem.set(null);
    this.confirming.set(true);
  }

  protected cancel(): void {
    this.confirming.set(false);
  }

  protected merge(): void {
    if (!this.canMerge()) return;
    this.confirming.set(false);
    const merge = { method: this.method(), headOid: this.detail().headOid };
    this.send({ merge }, MERGED);
  }

  protected markReady(): void {
    const view = this.view();
    if (!view.isDraft || view.ending || this.isSending()) return;
    this.send({ ready: true }, READIED);
  }

  /** Esc while confirming cancels the merge, and the screen stays open. */
  protected cancelOnEscape(event: Event): void {
    if (!this.confirming()) return;
    event.stopPropagation();
    this.cancel();
  }

  private send(changes: EditChanges, didIt: Outcome): void {
    this.problem.set(null);
    this.edits
      .save(changes)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sent) => {
        if (sent) this.saved.emit();
        const record = this.edits.last();
        if (!didIt(record)) this.problem.set(sent ? (record?.message ?? '') : UNREACHABLE);
      });
  }
}
