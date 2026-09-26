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
import { CollisionsFeed } from '../../../core/queue/collisions-feed';
import { HistoryFeed } from '../../../core/queue/history-feed';
import { LedgerFeed } from '../../../core/queue/ledger-feed';
import { QueueItem, shownBucket } from '../../../core/queue/queue-report';
import { QueueFeed } from '../../../core/queue/queue-feed';
import { queueFog } from '../../../core/queue/queue-fog';
import { TriageChoice, TriageClient } from '../../../core/queue/triage-client';
import { ViewerSession } from '../../../core/session/viewer-session';
import { Clock } from '../../../core/time/clock';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { UsageWatch } from '../../../core/usage/usage-watch';
import { HelpCard } from '../../../shared/help/help-card';
import { HelpShortcuts } from '../../../shared/help/help-shortcuts';
import { IssuesFeed } from '../../../core/issues/issues-feed';
import { openPullsOf } from '../../issues/issue-list';
import { IssuesPanel } from '../../issues/issues-panel/issues-panel';
import { IssuesScreen } from '../../issues/issues-screen';
import { ChangesPanel } from '../memory/changes-panel/changes-panel';
import { MemoryView } from '../memory/memory-view';
import { EFFECTS, MemoryItem, knownFates } from '../memory/news';
import { Timeline } from '../memory/timeline/timeline';
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
import { PrScreen } from '../pr-screen/pr-screen';
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
/** The changes panel's width and the gap beside it. */
const SIDE_PANEL_WIDTH = 380;
/** The card's Snooze, as pr-starmap's: a week. */
const SNOOZE_DAYS = 7;

/** Keys typed into a field belong to the field. */
const TYPING = 'input, textarea, select, [contenteditable]';

/** An open pull request as the memory compares it. */
const memoryItemOf = (item: QueueItem): MemoryItem => ({
  pr: item.number,
  title: item.title,
  bucket: shownBucket(item),
  idleDays: item.idleDays,
});

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
    ChangesPanel,
    Timeline,
    StarmapUsage,
    PrScreen,
    StarCard,
    LogCard,
    LogList,
    MeteorRecord,
    HelpCard,
  ],
  hostDirectives: [HelpShortcuts],
  host: {
    '(document:keydown.escape)': 'closeTopmost()',
    '(document:keydown)': 'onKey($event)',
  },
  providers: [
    QueueFeed,
    HistoryFeed,
    LedgerFeed,
    CollisionsFeed,
    LogsFeed,
    LogSkyView,
    MemoryView,
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
  private readonly ledger = inject(LedgerFeed);
  protected readonly memory = inject(MemoryView);
  protected readonly usage = inject(UsageWatch);
  private readonly triage = inject(TriageClient);
  protected readonly session = inject(ViewerSession);
  private readonly motion = inject(MotionPreference);
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
  /** The queue on screen: the live one, or a past refresh while replaying. */
  protected readonly shownItems = computed((): readonly QueueItem[] => {
    const replay = this.memory.replay();
    return replay ? replay.items.map((i) => this.replayed(i)) : this.items();
  });
  protected readonly skyItems = computed(() => this.shownItems().map(skyItemOf));
  /** The sky's news, as its layer reads it. */
  protected readonly skyNews = computed(() => {
    const news = this.memory.news();
    return { events: news.events, acknowledged: news.acknowledged };
  });
  protected readonly skyPairs = computed(() =>
    this.memory.replay() ? [] : (this.collisions.report()?.pairs ?? []).map(skyPairOf),
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
    const replay = this.memory.replay();
    const repo = report?.repo ?? this.repo();
    if (replay) {
      return `replay · ${repo} · ${replay.items.length} open as of ${new Date(replay.at).toLocaleString()} · ] steps forward, Live returns`;
    }
    return queueStamp(
      report?.repo ?? this.repo(),
      this.items().length,
      report?.generatedAt ?? null,
    );
  });
  /** How old the sky is, as fog: by the data's age, or at once when refreshes fail. */
  protected readonly fog = computed(() => {
    const report = this.report();
    if (!report || this.memory.replay()) return 0;
    const now = this.now();
    return Math.max(fogLevel(report.generatedAt, now), queueFog(this.state(), now.getTime()));
  });
  protected readonly stale = computed(() => {
    if (this.chart() === 'usage') return this.usageFog();
    if (this.chart() === 'issues') return this.issues.stale();
    const state = this.state();
    const report = this.report();
    if (!report || this.memory.replay()) return null;
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

  private readonly readAt = computed(() => this.report()?.generatedAt ?? null);
  /** pr-starmap's changes panel: while there is unseen news on the queue's map. */
  protected readonly showChanges = computed(() => {
    const news = this.memory.news();
    return (
      this.chart() === 'prs' &&
      this.view() === 'map' &&
      news.events.length > 0 &&
      !news.acknowledged
    );
  });
  /** The timeline under the queue's map, once the ledger has days to show. */
  protected readonly showTimeline = computed(
    () =>
      this.chart() === 'prs' &&
      this.view() === 'map' &&
      (this.memory.ledger()?.rows.length ?? 0) > 1,
  );
  protected readonly openItem = computed(
    () => this.shownItems().find((each) => each.number === this.openPull()) ?? null,
  );
  /** What the rest of the sky says about the selected pull request, for its card. */
  protected readonly cardContext = computed((): CardContext => {
    const number = this.openPull();
    const groups = binaries(this.skyItems(), (item) => item.issues);
    const replay = this.memory.replay();
    const news = this.memory.news();
    const event = news.events.find((e) => e.pr === number && EFFECTS[e.kind].onStar);
    const live = this.items().some((item) => item.number === number);
    return {
      replay: replay
        ? { at: replay.at, now: live ? 'still open' : this.fateNow(number ?? 0), live }
        : undefined,
      change: event
        ? { noun: EFFECTS[event.kind].noun, label: news.label, colour: EFFECTS[event.kind].colour }
        : undefined,
      pairs: this.skyPairs(),
      binaries: groups
        .filter((g) => g.members.some((item) => item.pr === number))
        .map((g) => ({
          issue: g.issue,
          others: g.members.map((item) => item.pr).filter((pr) => pr !== number),
        })),
    };
  });
  private readonly sheetItem = computed(
    () => this.items().find((each) => each.number === this.sheetPull()) ?? null,
  );
  protected readonly sheetBucket = computed(() => {
    const item = this.sheetItem();
    return item ? shownBucket(item) : null;
  });
  protected readonly sheetTitle = computed(() => this.sheetItem()?.title ?? null);
  /** The meteor record shows under the Log Sky's map, when it has days. */
  protected readonly showMeteors = computed(
    () => this.chart() === 'logs' && this.view() === 'map' && this.logs.hasDays(),
  );
  protected readonly insets = computed((): SkyInsets => {
    const wide = (this.window?.innerWidth ?? 0) > SIDE_PANEL_MIN_WIDTH;
    return {
      top: TOP_INSET,
      bottom: this.showMeteors() || this.showTimeline() ? BOTTOM_INSET_WITH_STRIP : BOTTOM_INSET,
      side: this.showChanges() && wide ? SIDE_PANEL_WIDTH : 0,
    };
  });

  constructor() {
    effect(() => {
      const repo = this.repo();
      untracked(() => {
        this.filter.set(null);
        this.openPull.set(null);
        this.sheetPull.set(null);
      });
      if (repo === '/') return;
      untracked(() => {
        this.memory.watch(repo);
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
    // Once the queue and its frames are both in, what changed plays on the sky.
    effect(() => {
      const report = this.report();
      if (!report || !this.memory.framesLoaded()) return;
      untracked(() => {
        const events = this.memory.announce(report.generatedAt, this.items().map(memoryItemOf));
        if (events.length) this.sky()?.fit();
        this.sky()?.play(events);
      });
    });
    // Replay lays the sky out before its news plays, as pr-starmap refreshed then played.
    this.memory.onPlay = (events) => setTimeout(() => this.sky()?.play(events));
    effect(() => {
      if (!this.readAt()) return;
      untracked(() => {
        this.history.load(this.repo());
        this.ledger.load(this.repo());
        this.collisions.load(this.repo());
        this.refreshing.set(false);
      });
    });
  }

  /** Switches screen by the address, so Back and a shared link keep it. */
  protected setChart(chart: Chart): void {
    // Replay belongs to the queue sky; every other sky is the present.
    this.memory.endReplay();
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

  /** A point on the timeline: the refresh there, or now. */
  protected scrub(index: number | null): void {
    if ((this.memory.replay()?.index ?? null) === index) return;
    this.memory.stopPlayer();
    this.openPull.set(null);
    this.memory.showFrame(index);
  }

  protected togglePlayer(): void {
    this.openPull.set(null);
    this.memory.togglePlayer(this.motion.isStill());
  }

  /** `[` and `]` step through the recorded refreshes, on the queue's sky. */
  protected onKey(event: KeyboardEvent): void {
    if (event.key !== '[' && event.key !== ']') return;
    const target = event.target;
    if (target instanceof Element && target.closest(TYPING)) return;
    if (this.chart() !== 'prs' || this.sheetPull() !== null) return;
    this.openPull.set(null);
    this.memory.step(event.key === '[' ? -1 : 1);
  }

  /** Where a pull request shown in replay stands today. */
  private fateNow(pr: number): string {
    return knownFates(this.memory.frames(), this.memory.ledger()).get(pr) ?? 'no longer open';
  }

  /** A replayed pull request, filled out from the live queue while it is still open. */
  private replayed(item: MemoryItem): QueueItem {
    const live = this.items().find((each) => each.number === item.pr);
    const base: QueueItem = live ?? {
      number: item.pr,
      title: item.title,
      url: `https://github.com/${this.repo()}/pull/${item.pr}`,
      isDraft: false,
      bucket: 'unreviewed',
      closes: [],
      failingChecks: 0,
      additions: null,
      deletions: null,
      idleDays: item.idleDays,
      ageDays: 0,
      branch: '',
      mergeable: 'UNKNOWN',
      changedFiles: null,
      isSeen: false,
      hidden: null,
    };
    const bucket = item.bucket === 'fresh' ? 'unreviewed' : item.bucket;
    return {
      ...base,
      title: item.title,
      bucket,
      isSeen: item.bucket === 'fresh',
      idleDays: item.idleDays,
    };
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
