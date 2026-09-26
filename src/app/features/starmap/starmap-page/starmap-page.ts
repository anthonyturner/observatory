import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ageWords, fogLevel } from '../../../core/projects/data-age';
import { changeCount, changesSince } from '../../../core/queue/changes';
import { CollisionsFeed } from '../../../core/queue/collisions-feed';
import { collisionsOf } from '../../../core/queue/collisions-report';
import { HistoryFeed } from '../../../core/queue/history-feed';
import { LastSeen } from '../../../core/queue/last-seen';
import { QueueFeed } from '../../../core/queue/queue-feed';
import { queueFog } from '../../../core/queue/queue-fog';
import { TriageChoice, TriageClient } from '../../../core/queue/triage-client';
import { Clock } from '../../../core/time/clock';
import { HelpCard } from '../../../shared/help/help-card';
import { HelpShortcuts } from '../../../shared/help/help-shortcuts';
import { IssuesTab } from '../../issues/issues-tab/issues-tab';
import { ChangesCard } from '../../queue/changes-card/changes-card';
import { PullPanel } from '../../queue/pull-panel/pull-panel';
import { QUEUE_HELP_ENTRIES, QUEUE_HELP_KEYS } from '../../queue/queue-help';
import { skyItemOf, skyPairOf } from '../sky-items';
import { StarmapHeader } from '../starmap-header/starmap-header';
import { StarmapPrList } from '../starmap-pr-list/starmap-pr-list';
import { SkyInsets, StarmapSky } from '../starmap-sky/starmap-sky';
import { StarmapTools } from '../starmap-tools/starmap-tools';
import {
  Chart,
  SkyView,
  chartOf,
  fragmentOf,
  isListOnly,
  queueChips,
  queueStamp,
  titleOf,
} from '../starmap-view';

/** The chrome Fit keeps the sky clear of, as pr-starmap measures it. */
const TOP_INSET = 140;
const BOTTOM_INSET = 70;
/** Past this width a panel down the right edge takes its own column. */
const SIDE_PANEL_MIN_WIDTH = 900;
const SIDE_PANEL_WIDTH = 370;

/** A message in place of the sky: a headline, and what to do about it. */
export interface SkyState {
  readonly headline: string;
  readonly detail?: string;
}

/**
 * pr-starmap's star map page: the sky, the list behind it, the header and
 * legend at the top and the tools along the bottom, for each of its screens.
 */
@Component({
  selector: 'app-starmap-page',
  imports: [
    StarmapSky,
    StarmapHeader,
    StarmapTools,
    StarmapPrList,
    IssuesTab,
    ChangesCard,
    PullPanel,
    HelpCard,
  ],
  hostDirectives: [HelpShortcuts],
  providers: [QueueFeed, HistoryFeed, CollisionsFeed],
  templateUrl: './starmap-page.html',
  styleUrl: './starmap-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarmapPage {
  private readonly feed = inject(QueueFeed);
  private readonly history = inject(HistoryFeed);
  private readonly collisions = inject(CollisionsFeed);
  private readonly lastSeenStore = inject(LastSeen);
  private readonly triage = inject(TriageClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly now = inject(Clock).now;
  private readonly window = inject(DOCUMENT).defaultView;

  protected readonly repo = toSignal(
    this.route.paramMap.pipe(
      map((params) => `${params.get('owner') ?? ''}/${params.get('repo') ?? ''}`),
    ),
    { initialValue: '' },
  );
  protected readonly chart = toSignal(this.route.fragment.pipe(map(chartOf)), {
    initialValue: 'prs' as Chart,
  });
  /** The pull-request and log skies share one view; issues are a list for now. */
  private readonly skyView = signal<SkyView>('map');
  protected readonly view = computed<SkyView>(() =>
    isListOnly(this.chart()) || this.chart() === 'issues' ? 'list' : this.skyView(),
  );
  protected readonly filter = signal<string | null>(null);
  protected readonly showCollisions = signal(true);
  protected readonly folded = signal(false);
  protected readonly refreshing = signal(false);
  protected readonly openPull = signal<number | null>(null);
  protected readonly sky = viewChild<StarmapSky>('sky');
  protected readonly helpEntries = QUEUE_HELP_ENTRIES;
  protected readonly helpKeys = QUEUE_HELP_KEYS;

  protected readonly state = this.feed.state;
  private readonly report = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.report : null;
  });
  /** Dismissed and snoozed pull requests leave the sky, as on pr-starmap. */
  protected readonly items = computed(() =>
    (this.report()?.items ?? []).filter((item) => item.hidden === null),
  );
  protected readonly skyItems = computed(() => this.items().map(skyItemOf));
  protected readonly skyPairs = computed(() =>
    (this.collisions.report()?.pairs ?? []).map(skyPairOf),
  );
  protected readonly title = computed(() => titleOf(this.chart()));
  protected readonly chips = computed(() =>
    this.chart() === 'prs' ? queueChips(this.skyItems()) : [],
  );
  protected readonly stamp = computed(() => {
    const report = this.report();
    if (this.chart() !== 'prs') return '';
    return queueStamp(
      report?.repo ?? this.repo(),
      this.items().length,
      report?.generatedAt ?? null,
    );
  });
  /** How old the sky is, as fog: by the data's age, or at once when refreshes fail. */
  protected readonly fog = computed(() => {
    const report = this.report();
    if (!report) return 0;
    const now = this.now();
    return Math.max(fogLevel(report.generatedAt, now), queueFog(this.state(), now.getTime()));
  });
  protected readonly stale = computed(() => {
    const state = this.state();
    const report = this.report();
    if (!report) return null;
    if (state.status === 'ready' && state.isStale) return 'refresh failing';
    const now = this.now();
    return fogLevel(report.generatedAt, now) > 0
      ? `fogged · ${ageWords(report.generatedAt, now)} old`
      : null;
  });
  protected readonly skyState = computed((): SkyState | null => {
    const chart = this.chart();
    if (chart === 'logs') {
      return {
        headline: 'No logs charted yet.',
        detail: 'Record a log folder with server/logs/set-dir.ts, then press Refresh.',
      };
    }
    if (chart === 'usage') return { headline: 'No usage read yet.' };
    if (chart !== 'prs' || this.view() === 'list') return null;
    const { status } = this.state();
    if (status === 'reading') return { headline: 'Reading the sky…' };
    if (status === 'unreachable') {
      return {
        headline: 'The queue is out of reach.',
        detail: 'Is the API running? Start it with npm start.',
      };
    }
    if (status === 'refused') return { headline: 'That is not a repository this page can read.' };
    if (!this.items().length) {
      return { headline: 'The queue is clear.', detail: 'Nothing is waiting on you.' };
    }
    return null;
  });

  // Carried over until pr-starmap's card, PR screen and memory replace them.
  private readonly lastSeen = signal<number | null>(null);
  private readonly readAt = computed(() => this.report()?.generatedAt ?? null);
  protected readonly changes = computed(() => {
    const readAt = this.readAt();
    return readAt
      ? changesSince(this.history.frames(), this.items(), this.lastSeen(), Date.parse(readAt))
      : null;
  });
  protected readonly hasChanges = computed(
    () => this.chart() === 'prs' && this.view() === 'map' && changeCount(this.changes()) > 0,
  );
  protected readonly openTriage = computed(() => {
    const item = this.items().find((each) => each.number === this.openPull());
    return item ? { isSeen: item.isSeen, hidden: item.hidden } : null;
  });
  protected readonly openCollisions = computed(() => {
    const number = this.openPull();
    return number === null ? [] : collisionsOf(this.collisions.report(), number);
  });
  protected readonly collisionCheck = computed(() => this.collisions.report()?.check ?? null);
  protected readonly insets = computed((): SkyInsets => {
    const wide = (this.window?.innerWidth ?? 0) > SIDE_PANEL_MIN_WIDTH;
    return {
      top: TOP_INSET,
      bottom: BOTTOM_INSET,
      side: this.hasChanges() && wide ? SIDE_PANEL_WIDTH : 0,
    };
  });

  constructor() {
    effect(() => {
      const repo = this.repo();
      untracked(() => {
        this.filter.set(null);
        this.openPull.set(null);
      });
      if (repo === '/') return;
      untracked(() => {
        this.lastSeen.set(this.lastSeenStore.read(repo));
        this.feed.watch(repo);
      });
    });
    effect(() => {
      if (!this.readAt()) return;
      untracked(() => {
        this.history.load(this.repo());
        this.collisions.load(this.repo());
        this.refreshing.set(false);
      });
    });
  }

  /** Switches screen by the address, so Back and a shared link keep it. */
  protected setChart(chart: Chart): void {
    this.filter.set(null);
    this.openPull.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      fragment: fragmentOf(chart),
      replaceUrl: true,
    });
  }

  protected setView(view: SkyView): void {
    this.skyView.set(view);
  }

  /** A legend chip narrows the sky to itself; pressing it again shows everything. */
  protected toggleFilter(id: string): void {
    this.filter.update((current) => (current === id ? null : id));
    this.openPull.set(null);
  }

  /** Flies to a star from the list, and opens it. */
  protected goTo(number: number): void {
    this.skyView.set('map');
    this.openPull.set(number);
    this.sky()?.goTo(number);
  }

  protected refresh(): void {
    this.refreshing.set(true);
    this.feed.refresh(this.repo());
  }

  protected acknowledgeChanges(): void {
    const now = Date.now();
    this.lastSeenStore.record(this.repo(), now);
    this.lastSeen.set(now);
  }

  protected recordTriage(number: number, choice: TriageChoice): void {
    const repo = this.repo();
    this.triage.record(repo, number, choice).subscribe(() => this.feed.refresh(repo));
  }
}
