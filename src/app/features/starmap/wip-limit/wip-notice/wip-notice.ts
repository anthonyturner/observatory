import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { WipCheck } from '../wip-check';

/** The gentle word, when more is open than the viewer's limit: top centre on a wide screen, else
 *  last in the star map header's right column. Closing it keeps it closed until the open count
 *  or the limit changes. */
@Component({
  selector: 'app-wip-notice',
  templateUrl: './wip-notice.html',
  styleUrl: './wip-notice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WipNotice {
  readonly check = input.required<WipCheck>();
  /** The sky is not the live review queue, so the notice has nothing to say. */
  readonly paused = input(false);

  private readonly standing = computed(() => `${this.check().open}/${this.check().limit}`);
  private readonly isClosed = linkedSignal({ source: this.standing, computation: () => false });
  protected readonly isShown = computed(
    () => this.check().isOver && !this.paused() && !this.isClosed(),
  );

  protected close(): void {
    this.isClosed.set(true);
  }
}
