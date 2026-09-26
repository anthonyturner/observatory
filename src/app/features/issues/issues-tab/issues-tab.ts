import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { IssuesFeed } from '../../../core/issues/issues-feed';
import { Clock } from '../../../core/time/clock';
import { issueGroups, issuesStamp } from '../issues-view';

/** A project's open issues: nobody-on-it first, then those a pull request is closing. */
@Component({
  selector: 'app-issues-tab',
  providers: [IssuesFeed],
  templateUrl: './issues-tab.html',
  styleUrl: './issues-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssuesTab {
  readonly repo = input.required<string>();

  private readonly feed = inject(IssuesFeed);
  private readonly now = inject(Clock).now;

  protected readonly query = signal('');
  protected readonly state = this.feed.state;
  private readonly items = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.report.items : [];
  });
  protected readonly groups = computed(() => issueGroups(this.items(), this.query()));
  protected readonly stamp = computed(() => issuesStamp(this.state(), this.now().getTime()));
  protected readonly pullBase = computed(() => `https://github.com/${this.repo()}/pull/`);
  protected readonly waiting = computed(() => {
    const { status } = this.state();
    if (status === 'reading') return 'Reading the issues from GitHub…';
    if (status === 'unreachable')
      return 'The issues are out of reach: is the API running (npm start)?';
    if (!this.items().length) return 'No open issues.';
    return this.groups().length ? null : 'No issue matches that search.';
  });

  constructor() {
    effect(() => this.feed.watch(this.repo()));
  }

  protected search(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
