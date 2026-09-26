import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CoreCanvas } from '../core-canvas/core-canvas';
import { CoreTouch } from '../core-touch/core-touch';

/** The centre of the HUD: the place the core is drawn, and its name. */
@Component({
  selector: 'app-core-panel',
  imports: [CoreCanvas, CoreTouch],
  templateUrl: './core-panel.html',
  styleUrl: './core-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorePanel {}
