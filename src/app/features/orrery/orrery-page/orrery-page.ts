import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ShippedFeed } from '../../../core/orrery/shipped-feed';
import { Router } from '@angular/router';
import { orreryStamp } from '../../../core/orrery/orrery-stamp';
import { DataAge } from '../../../core/projects/data-age';
import { PAGE_REFRESH } from '../../../core/projects/projects-refresh';
import { FogVeil } from '../../../shared/night-sky/fog-veil';
import { layoutWorlds } from '../../../core/orrery/world-layout';
import { PROJECTS, PROJECTS_STATE } from '../../../core/projects/projects-source';
import { Clock } from '../../../core/time/clock';
import { HelpCard } from '../../../shared/help/help-card';
import { HelpShortcuts } from '../../../shared/help/help-shortcuts';
import { UpLink } from '../../../shared/up-link/up-link';
import { ORRERY_HELP_ENTRIES, ORRERY_HELP_KEYS } from '../orrery-help';
import { ArrivalCue } from '../../../core/sound/orrery-score';
import { OrreryCanvas } from '../orrery-canvas/orrery-canvas';
import { OrreryTools } from '../orrery-tools/orrery-tools';
import { WorldCard } from '../world-card/world-card';
import { OrreryCues, OrreryFocus, provideOrrerySound } from '../orrery-sound';

/** What the page says in place of the system, by where the projects stand. */
const WAITING_MESSAGE = {
  reading: 'Reading your projects from GitHub…',
  unreachable: 'Projects out of reach: is the API running (npm start)?',
} as const;

/** The orrery: every project as a world in one system, round a sun of open work. */
@Component({
  selector: 'app-orrery-page',
  imports: [UpLink, OrreryCanvas, OrreryTools, WorldCard, HelpCard, FogVeil],
  hostDirectives: [HelpShortcuts],
  providers: [provideOrrerySound(), ShippedFeed],
  templateUrl: './orrery-page.html',
  styleUrl: './orrery-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'selected.set(null)' },
})
export class OrreryPage {
  private readonly router = inject(Router);
  private readonly state = inject(PROJECTS_STATE);
  private readonly now = inject(Clock).now;
  private readonly projects = inject(PROJECTS);
  private readonly cues = inject(OrreryCues);
  private readonly canvas = viewChild.required(OrreryCanvas);
  /** What the shown projects merged lately, for the Milky Way. */
  protected readonly shipped = inject(ShippedFeed);

  protected readonly helpEntries = ORRERY_HELP_ENTRIES;
  protected readonly helpKeys = ORRERY_HELP_KEYS;
  protected readonly selected = inject(OrreryFocus).selected;
  protected readonly worlds = computed(() => layoutWorlds(this.projects()));
  protected readonly selectedWorld = computed(
    () => this.worlds().find((world) => world.project.repo === this.selected()) ?? null,
  );
  /** The sky fogs over as the projects report ages, as on Home. */
  protected readonly fog = inject(DataAge).fog;
  private readonly page = inject(PAGE_REFRESH);
  protected readonly refreshing = signal(false);
  protected readonly stamp = computed(() => orreryStamp(this.state(), this.now().getTime()));
  protected readonly waiting = computed(() => {
    const state = this.state();
    if (state.status !== 'ready') return WAITING_MESSAGE[state.status];
    return state.report.projects.length
      ? null
      : 'No worlds yet: the signed-in GitHub account owns no repositories.';
  });

  constructor() {
    effect(() => {
      const state = this.state();
      if (state.status !== 'ready') return;
      const readAt = Date.parse(state.report.generatedAt);
      this.shipped.observe(state.report.projects, Number.isNaN(readAt) ? Date.now() : readAt);
    });
    this.shipped.arrived$
      .pipe(takeUntilDestroyed())
      .subscribe((item) => this.canvas().arrive(item));
  }

  /** The score plays a merge as its speck sets off, so the sound follows the picture. */
  protected hear(cue: ArrivalCue): void {
    this.cues.push(cue);
  }

  /** A world's review queue, one level down; Back returns here. */
  protected openQueue(repo: string): void {
    void this.router.navigateByUrl(`/p/${repo}`);
  }

  /** Home opens at the project's card, which Home brings into view. */
  protected showOnHome(repo: string): void {
    void this.router.navigate(['/'], { queryParams: { project: repo } });
  }

  /** Every world rebuilt from GitHub now, not from the API's cache; the fog clears with it. */
  protected async refresh(): Promise<void> {
    this.refreshing.set(true);
    try {
      await this.page.refresh();
    } finally {
      this.refreshing.set(false);
    }
  }
}
