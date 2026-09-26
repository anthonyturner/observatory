import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HudSection } from '../../../shared/hud-section/hud-section';

/** The left column: usage, the weekly limit, the top of the queue. */
@Component({
  selector: 'app-vitals-panel',
  imports: [HudSection],
  template: '<app-hud-section heading="System vitals" note="usage · issues" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VitalsPanel {}
