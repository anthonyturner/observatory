import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CORE_CHIPS, CoreChipId } from '../../../core/core-state/core-chips';

/** The assistant's states under the core, the one it is in lit. Display only. */
@Component({
  selector: 'app-core-chips',
  templateUrl: './core-chips.html',
  styleUrl: './core-chips.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoreChips {
  readonly lit = input.required<CoreChipId>();

  protected readonly chips = CORE_CHIPS;
}
