import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject } from '@angular/core';
import { AgentReviewCard } from '../agent-review-card/agent-review-card';
import { AgentsSection } from '../agents-section/agents-section';
import { AskPanel } from '../ask-panel/ask-panel';
import { CorePanel } from '../core-panel/core-panel';
import { FleetSection } from '../fleet-section/fleet-section';
import { MailSection } from '../mail-section/mail-section';
import { NewsSection } from '../news-section/news-section';
import { ReaderWindow } from '../../reader/reader-window/reader-window';
import { HelpCard } from '../../../shared/help/help-card';
import { HelpShortcuts } from '../../../shared/help/help-shortcuts';
import { CoreStateFeed } from '../../../core/core-state/core-state-feed';
import { HOME_HELP_KEYS, homeHelpEntries, withMailHelp } from '../help/help-content';
import { MAIL_PROVIDERS, MAIL_SHOWN } from '../../../core/mail/mail-inbox';
import { HomeTools } from '../home-tools/home-tools';
import { RunDockPanel } from '../run-dock/run-dock';
import { SkillsPanel } from '../skills-panel/skills-panel';
import { SkyBackdrop } from '../sky-backdrop/sky-backdrop';
import { MusicSky } from '../music-sky/music-sky';
import { TopBar } from '../top-bar/top-bar';
import { VitalsPanel } from '../vitals-panel/vitals-panel';
import { SoundPreference } from '../../../core/sound/sound-preference';
import { PlaylistPlacement } from '../../../core/playlist/playlist-placement';
import { RunDock } from '../../../core/runs/run-dock';
import { RunsStore } from '../../../core/runs/runs-store';

/** Home: the HUD over the sky, then mail, the news and the projects below the fold, and a
 *  task's panel beside them. It lays the sections out and nothing more. */
@Component({
  selector: 'app-home-page',
  imports: [
    ReaderWindow,
    SkyBackdrop,
    MusicSky,
    TopBar,
    CorePanel,
    AskPanel,
    VitalsPanel,
    SkillsPanel,
    FleetSection,
    AgentsSection,
    AgentReviewCard,
    MailSection,
    NewsSection,
    HelpCard,
    RunDockPanel,
    HomeTools,
  ],
  // Home's own score, which leaving Home stops; mail is read only while Home is shown.
  providers: [SoundPreference, MAIL_PROVIDERS],
  hostDirectives: [HelpShortcuts, CoreStateFeed],
  host: { '[class.docked]': 'dock.isOpen()' },
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly dock = inject(RunDock);
  private readonly runs = inject(RunsStore);
  /** Only once the local API answers for mail: never on the hosted site. */
  protected readonly hasMail = inject(MAIL_SHOWN);
  protected readonly helpEntries = computed(() => {
    const entries = homeHelpEntries(this.runs.isAvailable());
    return this.hasMail() ? withMailHelp(entries) : entries;
  });
  protected readonly helpKeys = HOME_HELP_KEYS;

  constructor() {
    const placement = inject(PlaylistPlacement);
    effect(() => placement.setBesideDock(this.dock.isOpen()));
    inject(DestroyRef).onDestroy(() => placement.setBesideDock(false));
  }
}
