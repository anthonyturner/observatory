import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Sparkline } from '../../../../shared/sparkline/sparkline';
import { VitalReading } from '../../data/vitals';

/** One vital: its label and age, the number or "unknown", and its trend.
 *  Unknown is said in words, in the muted ink: never a number, never green. */
@Component({
  selector: 'app-vital-readout',
  imports: [Sparkline],
  templateUrl: './vital-readout.html',
  styleUrl: './vital-readout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.hot]': 'reading().isHot',
    '[class.unknown]': 'isUnknown()',
  },
})
export class VitalReadout {
  readonly reading = input.required<VitalReading>();

  protected readonly isUnknown = computed(() => this.reading().value === null);
}
