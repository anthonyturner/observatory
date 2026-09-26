import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AskPanel } from '../ask-panel/ask-panel';
import { CorePanel } from '../core-panel/core-panel';
import { FleetSection } from '../fleet-section/fleet-section';
import { HelpCard } from '../../../shared/help/help-card';
import { HelpShortcuts } from '../../../shared/help/help-shortcuts';
import { HOME_HELP_ENTRIES, HOME_HELP_KEYS } from '../help/help-content';
import { SkillsPanel } from '../skills-panel/skills-panel';
import { SkyBackdrop } from '../sky-backdrop/sky-backdrop';
import { TopBar } from '../top-bar/top-bar';
import { VitalsPanel } from '../vitals-panel/vitals-panel';
import { SoundPreference } from '../../../core/sound/sound-preference';

/** Home: the HUD over the sky, then the projects below the fold. It lays the
 *  sections out and nothing more. */
@Component({
  selector: 'app-home-page',
  imports: [
    SkyBackdrop,
    TopBar,
    CorePanel,
    AskPanel,
    VitalsPanel,
    SkillsPanel,
    FleetSection,
    HelpCard,
  ],
  providers: [SoundPreference],
  hostDirectives: [HelpShortcuts],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly helpEntries = HOME_HELP_ENTRIES;
  protected readonly helpKeys = HOME_HELP_KEYS;
}
