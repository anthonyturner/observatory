import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { map } from 'rxjs';
import { AgentsFeed } from '../../../core/agents/agents-report';
import { InsightsFeed } from '../../../core/insights/insights-feed';
import { isCounting } from '../../../core/insights/insights-report';
import { ProjectBarRoom } from '../../../shared/project-bar-room/project-bar-room';
import { CommitStars } from '../commit-stars/commit-stars';
import { InsightsSections } from '../insights-sections/insights-sections';
import { COUNTING_NOTE, insightsStamp, stateMessage } from '../insights-words';

const repoOf = (params: ParamMap): string =>
  `${params.get('owner') ?? ''}/${params.get('repo') ?? ''}`;

/**
 * A project's Insights: its weekly commits, how long its pull requests took to
 * merge, who did the work, agents included, and who came to look, over the
 * last twelve weeks, under a constellation of those weeks.
 */
@Component({
  selector: 'app-insights-page',
  imports: [ProjectBarRoom, CommitStars, InsightsSections],
  providers: [InsightsFeed, AgentsFeed],
  templateUrl: './insights-page.html',
  styleUrls: ['../../releases/releases-page/releases-page.css', './insights-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsightsPage {
  private readonly feed = inject(InsightsFeed);
  private readonly repoChanges = inject(ActivatedRoute).paramMap.pipe(map(repoOf));

  protected readonly agents = inject(AgentsFeed);
  protected readonly repo = toSignal(this.repoChanges, { initialValue: '' });
  protected readonly countingNote = COUNTING_NOTE;

  protected readonly report = computed(() => {
    const state = this.feed.state();
    return state.status === 'ready' ? state.report : null;
  });
  protected readonly message = computed(() => stateMessage(this.feed.state()));
  protected readonly stamp = computed(() => insightsStamp(this.repo(), this.report()));
  protected readonly isCounting = computed(() => {
    const report = this.report();
    return report !== null && isCounting(report);
  });

  constructor() {
    this.repoChanges.pipe(takeUntilDestroyed()).subscribe((repo) => {
      this.feed.load(repo);
      this.agents.load(repo);
    });
  }

  protected recount(): void {
    this.feed.recount();
  }
}
