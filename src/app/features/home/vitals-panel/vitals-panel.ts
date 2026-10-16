import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HudSection } from '../../../shared/hud-section/hud-section';
import { VITALS_COLUMN } from '../data/vitals-column';
import { DirectiveList } from '../vitals/directive-list/directive-list';
import { VitalReadout } from '../vitals/vital-readout/vital-readout';
import { WeeklyGauge } from '../vitals/weekly-gauge/weekly-gauge';

/** The left column: usage, the weekly limit and the top of the queue. */
@Component({
  selector: 'app-vitals-panel',
  imports: [HudSection, VitalReadout, WeeklyGauge, DirectiveList],
  templateUrl: './vitals-panel.html',
  styleUrl: './vitals-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VitalsPanel {
  protected readonly column = inject(VITALS_COLUMN);
}
