import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { QueueFeed } from '../../../core/queue/queue-feed';
import { Clock } from '../../../core/time/clock';
import { QueueFilter, queueLegend, queueSections, queueStamp } from '../queue-view';

/** A project's review queue: its open pull requests, blocked first. */
@Component({
  selector: 'app-review-queue-page',
  imports: [RouterLink],
  providers: [QueueFeed],
  templateUrl: './review-queue-page.html',
  styleUrl: './review-queue-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewQueuePage {
  private readonly feed = inject(QueueFeed);
  private readonly now = inject(Clock).now;

  protected readonly repo = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => `${params.get('owner') ?? ''}/${params.get('repo') ?? ''}`),
    ),
    { initialValue: '' },
  );
  protected readonly filter = signal<QueueFilter>(null);
  protected readonly state = this.feed.state;
  private readonly items = computed(() => {
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
      if (repo !== '/') this.feed.watch(repo);
    });
  }

  /** A legend button filters to its bucket; pressing it again shows everything. */
  protected toggleFilter(filter: Exclude<QueueFilter, null>): void {
    this.filter.update((current) => (current === filter ? null : filter));
  }
}
