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
import { ViewerSession } from '../../../core/session/viewer-session';
import { Clock } from '../../../core/time/clock';
import { UsageWatch } from '../../../core/usage/usage-watch';
import { HelpCard } from '../../../shared/help/help-card';
import { HelpShortcuts } from '../../../shared/help/help-shortcuts';
import { IssuesFeed } from '../../../core/issues/issues-feed';
import { openPullsOf } from '../../issues/issue-list';
import { IssuesPanel } from '../../issues/issues-panel/issues-panel';
import { IssuesScreen } from '../../issues/issues-screen';
import { ChangesCard } from '../../queue/changes-card/changes-card';
import { PullPanel } from '../../queue/pull-panel/pull-panel';
import { binaries } from '../engine/binary-layer';
import { CardContext } from '../star-card/card-facts';
import { StarCard } from '../star-card/star-card';
import { LogsFeed } from '../../../core/logs/logs-feed';
import { LogKey } from '../../../core/logs/log-levels';
import { LogStar } from '../../../core/logs/log-layout';
import { LogCard } from '../../logs/log-card/log-card';
import { LogList } from '../../logs/log-list/log-list';
import { MeteorRecord } from '../../logs/meteor-record/meteor-record';
import { LogSkyView } from '../log-sky-view';
import { QUEUE_HELP_ENTRIES, QUEUE_HELP_KEYS } from '../../queue/queue-help';
import { skyItemOf, skyPairOf } from '../sky-items';
import { StarmapHeader } from '../starmap-header/starmap-header';
import { StarmapPrList } from '../starmap-pr-list/starmap-pr-list';
import { SkyInsets, StarmapSky } from '../starmap-sky/starmap-sky';
import { StarmapTools } from '../starmap-tools/starmap-tools';
import { StarmapUsage } from '../starmap-usage/starmap-usage';
import { usageStamp } from '../starmap-usage/usage-text';
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
/** With a chart along the bottom, as the Log Sky's meteor record. */
const BOTTOM_INSET_WITH_STRIP = 200;
/** Past this width a panel down the right edge takes its own column. */
const SIDE_PANEL_MIN_WIDTH = 900;
const SIDE_PANEL_WIDTH = 370;
/** The card's Snooze, as pr-starmap's: a week. */
const SNOOZE_DAYS = 7;

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
    IssuesPanel,
    StarmapUsage,
    ChangesCard,
    PullPanel,
    StarCard,
    LogCard,
    LogList,
    MeteorRecord,
    HelpCard,
  ],
  hostDirectives: [HelpShortcuts],
  host: { '(document:keydown.escape)': 'closeTopmost()' },
  providers: [
    QueueFeed,
    HistoryFeed,
    CollisionsFeed,
    LogsFeed,
    LogSkyView,
    UsageWatch,
    IssuesFeed,
    IssuesScreen,
  ],
  templateUrl: './starmap-page.html',
  styleUrl: './starmap-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarmapPage {
  private readonly feed = inject(QueueFeed);
  private readonly history = inject(HistoryFeed);
  private readonly collisions = inject(CollisionsFeed);
  protected readonly usage = inject(UsageWatch);
  private readonly lastSeenStore = inject(LastSeen);
  private readonly triage = inject(TriageClient);
  protected readonly session = inject(ViewerSession);
  protected readonly logs = inject(LogSkyView);
  protected readonly issues = inject(IssuesScreen);
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
  private readonly fragment = toSignal(this.route.fragment, { initialValue: null });
  protected readonly chart = computed<Chart>(() => chartOf(this.fragment()));
  /** The pull-request and log skies share one view; issues are a list for now. */
  private readonly skyView = signal<SkyView>('map');
  protected readonly view = computed<SkyView>(() =>
    isListOnly(this.chart()) || this.chart() === 'issues' ? 'list' : this.skyView(),
  );
  protected readonly filter = signal<string | null>(null);
  protected readonly showCollisions = signal(true);
  protected readonly folded = signal(false);
  protected readonly refreshing = signal(false);
  /** The pull request whose star is selected, its card open. */
  protected readonly openPull = signal<number | null>(null);
  /** The pull request whose full screen is open. */
  readonly sheetPull = signal<number | null>(null);
  protected readonly SNOOZE_DAYS = SNOOZE_DAYS;
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
  protected readonly chips = computed(() => {
    const chart = this.chart();
    if (chart === 'issues') return this.issues.chips();
    return chart === 'prs' ? queueChips(this.skyItems()) : [];
  });
  /** What the legend has narrowed the screen to. */
  protected readonly legendFilter = computed(() =>
    this.chart() === 'issues' ? this.issues.filter() : this.filter(),
  );
  /** The open pull requests the queue knows, for the issues' chips. */
  protected readonly openPulls = computed(() => openPullsOf(this.report()?.items ?? []));
  private readonly usageDocument = computed(() => {
    const state = this.usage.state();
    return state.status === 'ready' ? state.document : null;
  });
  protected readonly stamp = computed(() => {
    const report = this.report();
    if (this.chart() === 'usage') return usageStamp(this.usageDocument());
    if (this.chart() === 'issues') return this.issues.stamp();
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
    if (this.chart() === 'usage') return this.usageFog();
    if (this.chart() === 'issues') return this.issues.stale();
    const state = this.state();
    const report = this.report();
    if (!report) return null;
    if (state.status === 'ready' && state.isStale) return 'refresh failing';
    const now = this.now();
    return fogLevel(report.generatedAt, now) > 0
      ? `fogged · ${ageWords(report.generatedAt, now)} old`
      : null;
  });
  /** Usage fogs by its own age, as the queue does by the queue's. */
  private readonly usageFog = computed(() => {
    const generatedAt = this.usageDocument()?.generatedAt;
    const now = this.now();
    return generatedAt && fogLevel(generatedAt, now) > 0
      ? `fogged · ${ageWords(generatedAt, now)} old`
      : null;
  });
  protected readonly skyState = computed((): SkyState | null => {
    const chart = this.chart();
    if (chart === 'logs') return this.view() === 'map' ? this.logs.message() : null;
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
  protected readonly openItem = computed(
    () => this.items().find((each) => each.number === this.openPull()) ?? null,
  );
  /** What the rest of the sky says about the selected pull request, for its card. */
  protected readonly cardContext = computed((): CardContext => {
    const number = this.openPull();
    const groups = binaries(this.skyItems(), (item) => item.issues);
    return {
      pairs: this.skyPairs(),
      binaries: groups
        .filter((g) => g.members.some((item) => item.pr === number))
        .map((g) => ({
          issue: g.issue,
          others: g.members.map((item) => item.pr).filter((pr) => pr !== number),
        })),
    };
  });
  protected readonly sheetTriage = computed(() => {
    // A visitor to the hosted preview cannot change anything, so has no triage to show.
    if (!this.session.canWrite()) return null;
    const item = this.items().find((each) => each.number === this.sheetPull());
    return item ? { isSeen: item.isSeen, hidden: item.hidden } : null;
  });
  protected readonly sheetCollisions = computed(() => {
    const number = this.sheetPull();
    return number === null ? [] : collisionsOf(this.collisions.report(), number);
  });
  protected readonly collisionCheck = computed(() => this.collisions.report()?.check ?? null);
  /** The meteor record shows under the Log Sky's map, when it has days. */
  protected readonly showMeteors = computed(
    () => this.chart() === 'logs' && this.view() === 'map' && this.logs.hasDays(),
  );
  protected readonly insets = computed((): SkyInsets => {
    const wide = (this.window?.innerWidth ?? 0) > SIDE_PANEL_MIN_WIDTH;
    return {
      top: TOP_INSET,
      bottom: this.showMeteors() ? BOTTOM_INSET_WITH_STRIP : BOTTOM_INSET,
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
        this.logs.clear();
        this.logs.watch(repo);
        this.issues.watch(repo);
      });
    });
    this.issues.openAt(this.fragment());
    // The Issues tab lives in the address too, so Back and a shared link keep it.
    effect(() => {
      const fragment = this.issues.fragment();
      if (this.chart() !== 'issues') return;
      untracked(() => this.navigateTo(fragment));
    });
    // A refresh lays the Log Sky out again; the card and threads follow their fault.
    effect(() => {
      this.logs.layout();
      untracked(() => this.logs.follow());
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
    this.logs.clear();
    this.logs.filter.set(null);
    this.issues.clearFilter();
    this.navigateTo(chart === 'issues' ? this.issues.fragment() : fragmentOf(chart));
  }

  private navigateTo(fragment: string | undefined): void {
    if ((this.fragment() ?? undefined) === fragment) return;
    void this.router.navigate([], { relativeTo: this.route, fragment, replaceUrl: true });
  }

  protected setView(view: SkyView): void {
    this.skyView.set(view);
  }

  /** A legend chip narrows the sky to itself; pressing it again shows everything. */
  protected toggleFilter(id: string): void {
    if (this.chart() === 'logs') {
      this.logs.toggleFilter(id as LogKey);
      return;
    }
    if (this.chart() === 'issues') {
      this.issues.toggleComets();
      return;
    }
    this.filter.update((current) => (current === id ? null : id));
    this.openPull.set(null);
  }

  /** Flies to a fault from the log list, opens its card and traces it. */
  protected goToLog(star: LogStar): void {
    this.skyView.set('map');
    this.logs.pick(star);
    this.sky()?.goToLog(star);
  }

  /** Flies to a star from the list, and opens it. */
  protected goTo(number: number): void {
    this.skyView.set('map');
    this.openPull.set(number);
    this.sky()?.goTo(number);
  }

  protected refresh(): void {
    if (this.chart() === 'usage') {
      this.usage.refresh();
      return;
    }
    this.refreshing.set(true);
    this.feed.refresh(this.repo());
    this.issues.refresh(this.repo());
  }

  protected acknowledgeChanges(): void {
    const now = Date.now();
    this.lastSeenStore.record(this.repo(), now);
    this.lastSeen.set(now);
  }

  /** Esc closes the full screen first, then the card, as on pr-starmap. */
  protected closeTopmost(): void {
    if (this.sheetPull() !== null) this.sheetPull.set(null);
    else if (this.chart() === 'logs') this.logs.closeCard();
    else this.openPull.set(null);
  }

  /** Opens a pull request's full screen, from its card or another screen. */
  openSheet(number: number): void {
    this.sheetPull.set(number);
  }

  protected recordTriage(number: number, choice: TriageChoice): void {
    const repo = this.repo();
    this.triage.record(repo, number, choice).subscribe(() => this.feed.refresh(repo));
  }
}
