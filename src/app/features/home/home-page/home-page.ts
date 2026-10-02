import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AgentReviewCard } from '../agent-review-card/agent-review-card';
import { AgentsSection } from '../agents-section/agents-section';
import { AskPanel } from '../ask-panel/ask-panel';
import { CorePanel } from '../core-panel/core-panel';
import { FleetSection } from '../fleet-section/fleet-section';
import { NewsSection } from '../news-section/news-section';
import { ReaderWindow } from '../../reader/reader-window/reader-window';
import { HelpCard } from '../../../shared/help/help-card';
import { HelpShortcuts } from '../../../shared/help/help-shortcuts';
import { CoreStateFeed } from '../../../core/core-state/core-state-feed';
import { HOME_HELP_KEYS, homeHelpEntries } from '../help/help-content';
import { HomeTools } from '../home-tools/home-tools';
import { RunDockPanel } from '../run-dock/run-dock';
import { SkillsPanel } from '../skills-panel/skills-panel';
import { SkyBackdrop } from '../sky-backdrop/sky-backdrop';
import { TopBar } from '../top-bar/top-bar';
import { TransportBar } from '../transport-bar/transport-bar';
import { VitalsPanel } from '../vitals-panel/vitals-panel';
import { SoundPreference } from '../../../core/sound/sound-preference';
import { RunDock } from '../../../core/runs/run-dock';
import { RunsStore } from '../../../core/runs/runs-store';

/** Home: the HUD over the sky, then the news and the projects below the fold, and a
 *  task's panel beside them. It lays the sections out and nothing more. */
@Component({
  selector: 'app-home-page',
  imports: [
    ReaderWindow,
    SkyBackdrop,
    TopBar,
    CorePanel,
    AskPanel,
    VitalsPanel,
    SkillsPanel,
    FleetSection,
    AgentsSection,
    AgentReviewCard,
    NewsSection,
    HelpCard,
    RunDockPanel,
    HomeTools,
    TransportBar,
  ],
  providers: [SoundPreference],
  hostDirectives: [HelpShortcuts, CoreStateFeed],
  host: { '[class.docked]': 'dock.isOpen()' },
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly dock = inject(RunDock);
  private readonly runs = inject(RunsStore);
  protected readonly helpEntries = computed(() => homeHelpEntries(this.runs.isAvailable()));
  protected readonly helpKeys = HOME_HELP_KEYS;
}
