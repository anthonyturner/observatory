import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { QueueFeed } from '../../../core/queue/queue-feed';
import { Clock } from '../../../core/time/clock';
import { IssuesTab } from '../../issues/issues-tab/issues-tab';
import { OrreryTools } from '../../orrery/orrery-tools/orrery-tools';
import { PullPanel } from '../pull-panel/pull-panel';
import { QueueFilter, queueLegend, queueSections, queueStamp } from '../queue-view';
import { StarChart } from '../star-chart/star-chart';

export type QueueView = 'map' | 'list';
/** The project page's tabs; the address fragment picks one (`#issues`). */
export type ProjectTab = 'pulls' | 'issues';
const ISSUES_FRAGMENT = 'issues';

/** A project's review queue: its open pull requests, blocked first. */
@Component({
  selector: 'app-review-queue-page',
  imports: [RouterLink, PullPanel, StarChart, OrreryTools, IssuesTab],
  providers: [QueueFeed],
  templateUrl: './review-queue-page.html',
  styleUrl: './review-queue-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewQueuePage {
  private readonly feed = inject(QueueFeed);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
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
  protected readonly filter = signal<QueueFilter>(null);
  /** The star map, or the list: the map first, as pr-starmap opens. */
  protected readonly view = signal<QueueView>('map');
  protected readonly chart = viewChild<StarChart>('chart');
  /** The pull request whose panel is open, if any. */
  protected readonly openPull = signal<number | null>(null);
  protected readonly state = this.feed.state;
  protected readonly items = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.report.items : [];
  });
  protected readonly legend = computed(() => queueLegend(this.items()));
  protected readonly sections = computed(() => queueSections(this.items(), this.filter()));
  protected readonly stamp = computed(() => queueStamp(this.state(), this.now().getTime()));
  protected readonly waiting = computed(() => {
    const { status } = this.state();
    if (status === 'reading') return 'Reading the queue from GitHub…';
    if (status === 'unreachable')
      return 'The queue is out of reach: is the API running (npm start)?';
    if (status === 'refused') return 'That is not a repository this page can read.';
    return this.items().length ? null : 'Nothing open: no pull request is waiting.';
  });

  constructor() {
    effect(() => {
      const repo = this.repo();
      this.filter.set(null);
      this.openPull.set(null);
      if (repo !== '/') this.feed.watch(repo);
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

  /** A legend button filters to its bucket; pressing it again shows everything. */
  protected toggleFilter(filter: Exclude<QueueFilter, null>): void {
    this.filter.update((current) => (current === filter ? null : filter));
  }
}
