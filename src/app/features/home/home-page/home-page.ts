import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AskPanel } from '../ask-panel/ask-panel';
import { CorePanel } from '../core-panel/core-panel';
import { FleetSection } from '../fleet-section/fleet-section';
import { SkillsPanel } from '../skills-panel/skills-panel';
import { SkyBackdrop } from '../sky-backdrop/sky-backdrop';
import { VitalsPanel } from '../vitals-panel/vitals-panel';

/** Home: the HUD over the sky, then the projects below the fold. It lays the
 *  sections out and nothing more. */
@Component({
  selector: 'app-home-page',
  imports: [SkyBackdrop, CorePanel, AskPanel, VitalsPanel, SkillsPanel, FleetSection],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {}
