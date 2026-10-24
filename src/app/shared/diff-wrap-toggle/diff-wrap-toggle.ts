import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DiffWrapChoice } from '../../core/queue/diff-wrap-choice';

/** The "Wrap long lines" switch: one choice for every diff, in this tab and any other. */
@Component({
  selector: 'app-diff-wrap-toggle',
  template: `<label class="wrap-toggle">
    <input type="checkbox" [checked]="wraps()" (change)="onChange($event)" />
    Wrap long lines
  </label>`,
  styleUrl: './diff-wrap-toggle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiffWrapToggle {
  private readonly choice = inject(DiffWrapChoice);

  protected readonly wraps = this.choice.wraps;

  protected onChange(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.choice.choose(event.target.checked);
  }
}
