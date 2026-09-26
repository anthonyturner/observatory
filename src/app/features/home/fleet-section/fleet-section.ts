import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Below the HUD: a card per project, blocked first. */
@Component({
  selector: 'app-fleet-section',
  templateUrl: './fleet-section.html',
  styleUrl: './fleet-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetSection {}
