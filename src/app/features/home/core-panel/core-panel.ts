import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CORE_CHIP } from '../../../core/core-state/core-state-tokens';
import { CORE_MOOD } from '../../../core/instrument/core-tokens';
import { DataAge } from '../../../core/projects/data-age';
import { CoreCanvas } from '../core-canvas/core-canvas';
import { CoreChips } from '../core-chips/core-chips';
import { CoreTouch } from '../core-touch/core-touch';

/** The centre of the HUD: the place the core is drawn, its name, and the
 *  assistant's state. */
@Component({
  selector: 'app-core-panel',
  imports: [CoreCanvas, CoreTouch, CoreChips],
  templateUrl: './core-panel.html',
  styleUrl: './core-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorePanel {
  protected readonly mood = inject(CORE_MOOD);
  protected readonly chip = inject(CORE_CHIP);
  protected readonly fog = inject(DataAge).fog;
}
