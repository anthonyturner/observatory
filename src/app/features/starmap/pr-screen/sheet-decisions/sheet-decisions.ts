import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { MERGE_METHODS, MergeMethod } from '../../../../core/edits/edit-record';

const SHORT_OID_LENGTH = 7;

/** The two decisions that are the requester's alone, apart from the edits in a
 *  warmer frame so they never read as just more fields. */
@Component({
  selector: 'app-sheet-decisions',
  templateUrl: './sheet-decisions.html',
  styleUrl: './sheet-decisions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetDecisions {
  readonly number = input.required<number>();
  readonly isDraft = input.required<boolean>();
  readonly mergeable = input.required<string>();
  readonly headOid = input.required<string>();
  readonly ready = model.required<boolean>();
  readonly method = model.required<MergeMethod | ''>();
  readonly confirm = model.required<string>();

  protected readonly methods = MERGE_METHODS;
  protected readonly shortOid = computed(() => this.headOid().slice(0, SHORT_OID_LENGTH));
  protected readonly conflicts = computed(() => this.mergeable() === 'CONFLICTING');

  protected pickMethod(value: string): void {
    this.method.set(
      (MERGE_METHODS as readonly string[]).includes(value) ? (value as MergeMethod) : '',
    );
  }
}
