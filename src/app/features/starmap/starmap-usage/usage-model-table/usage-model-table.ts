import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ModelRow } from '../token-views';

/** Each model's replies and tokens, keyed by its family's colour. */
@Component({
  selector: 'app-usage-model-table',
  templateUrl: './usage-model-table.html',
  styleUrl: './usage-model-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageModelTable {
  readonly rows = input.required<readonly ModelRow[]>();
}
