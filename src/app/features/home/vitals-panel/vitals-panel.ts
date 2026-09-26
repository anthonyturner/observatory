import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HudSection } from '../../../shared/hud-section/hud-section';
import { VITALS_COLUMN } from '../data/vitals-column';
import { DirectiveList } from '../vitals/directive-list/directive-list';
import { DocTabs } from '../vitals/doc-tabs/doc-tabs';
import { VitalReadout } from '../vitals/vital-readout/vital-readout';
import { WeeklyGauge } from '../vitals/weekly-gauge/weekly-gauge';

/** The left column: usage, the weekly limit, the top of the queue, and the
 *  way to the other views. */
@Component({
  selector: 'app-vitals-panel',
  imports: [HudSection, VitalReadout, WeeklyGauge, DirectiveList, DocTabs],
  templateUrl: './vitals-panel.html',
  styleUrl: './vitals-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VitalsPanel {
  protected readonly column = inject(VITALS_COLUMN);
}
