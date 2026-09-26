import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DetailBlock } from '../../../../core/runs/transcript/transcript.types';

/** A titled block of text in an opened row, cut to its first lines until
 *  Show all. */
@Component({
  selector: 'app-detail-block',
  template: `<h4>{{ block().title }}</h4>
    <pre>{{ shown() }}</pre>
    @if (hidden(); as count) {
      <button type="button" (click)="isWhole.set(true)">Show all ({{ count }} lines)</button>
    }`,
  styleUrl: './detail-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailBlockView {
  readonly block = input.required<DetailBlock>();

  protected readonly isWhole = signal(false);
  private readonly lines = computed(() => this.block().text.replace(/\r\n/g, '\n').split('\n'));
  protected readonly shown = computed(() =>
    this.isWhole() ? this.lines().join('\n') : this.lines().slice(0, this.block().lines).join('\n'),
  );
  /** Every line's count while some are cut, else 0. */
  protected readonly hidden = computed(() => {
    const count = this.lines().length;
    return !this.isWhole() && count > this.block().lines ? count : 0;
  });
}
