import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { Heat, MapEntry } from '../../../core/architecture/architecture-graph';
import { ArchitectureArea } from '../../../core/architecture/architecture.types';

/** How many classes carry each heat, shown on the chips that filter by it. */
export interface HeatTotals {
  readonly unused: number;
  readonly hot: number;
}

/** The map's nodes as a searchable list, most depended-on first. */
@Component({
  selector: 'app-node-index',
  templateUrl: './node-index.html',
  styleUrl: './node-index.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeIndex {
  readonly entries = input.required<readonly MapEntry[]>();
  readonly areas = input.required<readonly ArchitectureArea[]>();
  /** The Overwolf windows to filter by; none hides the filter. */
  readonly windows = input.required<readonly string[]>();
  readonly totals = input.required<HeatTotals>();
  /** The id of the node at the centre, marked in the list. */
  readonly selected = input<string | null>(null);

  readonly query = model('');
  readonly area = model<string | null>(null);
  readonly window = model<string | null>(null);
  readonly heat = model<Heat | null>(null);
  /** The id of the node to put at the centre next. */
  readonly pick = output<string>();
}
