import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Heat } from '../../../core/architecture/architecture-graph';
import { NodeKind } from '../../../core/architecture/architecture.types';

/**
 * A small mark for one kind of node, in the legend and beside each name in the index.
 * Colour is never the only cue: a module is a square, a route a diamond, a component
 * and an outside service hollow, and heat (unused, hot) overrides the kind.
 */
@Component({
  selector: 'app-kind-dot',
  template: '',
  styleUrl: './kind-dot.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[attr.data-kind]': 'kind()',
    '[attr.data-heat]': 'heat()',
  },
})
export class KindDot {
  readonly kind = input.required<NodeKind>();
  readonly heat = input<Heat>('plain');
}
