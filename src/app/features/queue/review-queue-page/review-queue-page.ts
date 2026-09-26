import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { changeCount, changesSince } from '../../../core/queue/changes';
import { CollisionsFeed } from '../../../core/queue/collisions-feed';
import { collisionSummary, collisionsOf } from '../../../core/queue/collisions-report';
import { HistoryFeed } from '../../../core/queue/history-feed';
import { LastSeen } from '../../../core/queue/last-seen';
import { QueueFeed } from '../../../core/queue/queue-feed';
import { queueFog } from '../../../core/queue/queue-fog';
import { TriageChoice, TriageClient } from '../../../core/queue/triage-client';
import { Clock } from '../../../core/time/clock';
import { IssuesTab } from '../../issues/issues-tab/issues-tab';
import { FogVeil } from '../../../shared/night-sky/fog-veil';
import { HelpButton } from '../../../shared/help/help-button';
import { HelpCard } from '../../../shared/help/help-card';
import { HelpShortcuts } from '../../../shared/help/help-shortcuts';
import { QUEUE_HELP_ENTRIES, QUEUE_HELP_KEYS } from '../queue-help';
import { ChangesCard } from '../changes-card/changes-card';
import { QueueList } from '../queue-list/queue-list';
import { OrreryTools } from '../../orrery/orrery-tools/orrery-tools';
import { PullPanel } from '../pull-panel/pull-panel';
import { ViewerSession } from '../../../core/session/viewer-session';
import {
  QueueFilter,
  hiddenCount,
  queueLegend,
  queueSections,
  queueStamp,
  visibleItems,
} from '../queue-view';
import { StarmapSky } from '../../starmap/starmap-sky/starmap-sky';
import { skyItemOf, skyPairOf } from '../../starmap/sky-items';

export type QueueView = 'map' | 'list';
/** The project page's tabs; the address fragment picks one (`#issues`). */
export type ProjectTab = 'pulls' | 'issues';
const ISSUES_FRAGMENT = 'issues';

/** A project's review queue: its open pull requests, blocked first. */
@Component({
  selector: 'app-review-queue-page',
  imports: [
    RouterLink,
    PullPanel,
    StarmapSky,
    OrreryTools,
    IssuesTab,
    ChangesCard,
    QueueList,
    HelpButton,
    HelpCard,
    FogVeil,
  ],
  hostDirectives: [HelpShortcuts],
  providers: [QueueFeed, HistoryFeed, CollisionsFeed],
  templateUrl: './review-queue-page.html',
  styleUrl: './review-queue-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewQueuePage {
  private readonly feed = inject(QueueFeed);
  private readonly history = inject(HistoryFeed);
  private readonly collisions = inject(CollisionsFeed);
  private readonly lastSeenStore = inject(LastSeen);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly triage = inject(TriageClient);
  private readonly session = inject(ViewerSession);
  private readonly now = inject(Clock).now;

  protected readonly repo = toSignal(
    this.route.paramMap.pipe(
      map((params) => `${params.get('owner') ?? ''}/${params.get('repo') ?? ''}`),
    ),
    { initialValue: '' },
  );
  protected readonly tab = toSignal(
    this.route.fragment.pipe(
      map((fragment): ProjectTab => (fragment === ISSUES_FRAGMENT ? 'issues' : 'pulls')),
    ),
    { initialValue: 'pulls' as ProjectTab },
  );
  protected readonly helpEntries = QUEUE_HELP_ENTRIES;
  protected readonly helpKeys = QUEUE_HELP_KEYS;
  protected readonly filter = signal<QueueFilter>(null);
  /** The star map, or the list: the map first, as pr-starmap opens. */
  protected readonly view = signal<QueueView>('map');
  protected readonly chart = viewChild<StarmapSky>('chart');
  /** The pull request whose panel is open, if any. */
  protected readonly openPull = signal<number | null>(null);
  protected readonly state = this.feed.state;
  protected readonly items = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.report.items : [];
  });
  /** Whether snoozed and dismissed pull requests are shown too. */
  protected readonly showHidden = signal(false);
  protected readonly hidden = computed(() => hiddenCount(this.items()));
  /** What the chart, legend and list show. */
  protected readonly visible = computed(() => visibleItems(this.items(), this.showHidden()));
  protected readonly legend = computed(() => queueLegend(this.visible()));
  protected readonly sections = computed(() => queueSections(this.visible(), this.filter()));
  /** The open pull request's triage, for its panel. */
  protected readonly openTriage = computed(() => {
    // A visitor to the hosted preview cannot change anything, so has no triage to show.
    if (!this.session.canWrite()) return null;
    const item = this.items().find((each) => each.number === this.openPull());
    return item ? { isSeen: item.isSeen, hidden: item.hidden } : null;
  });
  /** When you last looked at this queue, from this browser. */
  private readonly lastSeen = signal<number | null>(null);
  private readonly readAt = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.report.generatedAt : null;
  });
  protected readonly changes = computed(() => {
    const readAt = this.readAt();
    return readAt
      ? changesSince(this.history.frames(), this.items(), this.lastSeen(), Date.parse(readAt))
      : null;
  });
  protected readonly hasChanges = computed(() => changeCount(this.changes()) > 0);
  /** The queue as pr-starmap's sky charts it, and its collision pairs. */
  protected readonly skyItems = computed(() => this.visible().map(skyItemOf));
  protected readonly skyPairs = computed(() =>
    (this.collisions.report()?.pairs ?? []).map(skyPairOf),
  );
  protected readonly collisionNote = computed(() => collisionSummary(this.collisions.report()));
  protected readonly collisionCheck = computed(() => this.collisions.report()?.check ?? null);
  /** The open pull request's collisions, for its panel. */
  protected readonly openCollisions = computed(() => {
    const number = this.openPull();
    return number === null ? [] : collisionsOf(this.collisions.report(), number);
  });
  protected readonly fog = computed(() => queueFog(this.state(), this.now().getTime()));
  protected readonly stamp = computed(() => queueStamp(this.state(), this.now().getTime()));
  protected readonly waiting = computed(() => {
    const { status } = this.state();
    if (status === 'reading') return 'Reading the queue from GitHub…';
    if (status === 'unreachable')
      return 'The queue is out of reach: is the API running (npm start)?';
    if (status === 'refused') return 'That is not a repository this page can read.';
    if (!this.items().length) return 'Nothing open: no pull request is waiting.';
    return this.visible().length ? null : 'Everything open is snoozed or dismissed.';
  });

  constructor() {
    effect(() => {
      const repo = this.repo();
      this.filter.set(null);
      this.openPull.set(null);
      if (repo === '/') return;
      this.lastSeen.set(this.lastSeenStore.read(repo));
      this.feed.watch(repo);
    });
    // Each read from GitHub may have added a frame or moved a branch, so both follow the queue.
    effect(() => {
      if (!this.readAt()) return;
      untracked(() => {
        this.history.load(this.repo());
        this.collisions.load(this.repo());
      });
    });
  }

  /** Switches tab by the address, so Back and a shared link keep it. */
  protected showTab(tab: ProjectTab): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      fragment: tab === 'issues' ? ISSUES_FRAGMENT : undefined,
      replaceUrl: true,
    });
  }

  /** Records this visit, which clears what changed before it. */
  protected acknowledgeChanges(): void {
    const now = Date.now();
    this.lastSeenStore.record(this.repo(), now);
    this.lastSeen.set(now);
  }

  /** Records a triage action, then reads the queue again to show it. */
  protected recordTriage(number: number, choice: TriageChoice): void {
    const repo = this.repo();
    this.triage.record(repo, number, choice).subscribe(() => this.feed.refresh(repo));
  }

  /** A legend button filters to its bucket; pressing it again shows everything. */
  protected toggleFilter(filter: Exclude<QueueFilter, null>): void {
    this.filter.update((current) => (current === filter ? null : filter));
  }
}
