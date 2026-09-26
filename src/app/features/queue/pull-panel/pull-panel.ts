import { A11yModule } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { PullDetailFeed } from '../../../core/queue/pull-detail-feed';
import { Clock } from '../../../core/time/clock';
import { DECISION_LABEL, checkTally, checksToName, shortDate } from '../pull-view';
import { BUCKET_LOOK } from '../queue-view';

/** One pull request's details, beside the queue: why it is where it is,
 *  its checks, its review, what it closes, and its description. */
@Component({
  selector: 'app-pull-panel',
  imports: [A11yModule],
  providers: [PullDetailFeed],
  templateUrl: './pull-panel.html',
  styleUrl: './pull-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class PullPanel {
  readonly repo = input.required<string>();
  readonly number = input.required<number>();
  readonly closed = output<void>();

  private readonly feed = inject(PullDetailFeed);
  private readonly now = inject(Clock).now;

  protected readonly state = this.feed.state;
  protected readonly detail = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.detail : null;
  });
  protected readonly look = computed(() => {
    const detail = this.detail();
    return detail ? BUCKET_LOOK[detail.bucket] : null;
  });
  protected readonly tally = computed(() => checkTally(this.detail()?.checks ?? []));
  protected readonly namedChecks = computed(() => checksToName(this.detail()?.checks ?? []));
  protected readonly decision = computed(
    () => DECISION_LABEL[this.detail()?.reviewDecision ?? 'none'],
  );
  protected readonly issueBase = computed(() => `https://github.com/${this.repo()}/issues/`);

  constructor() {
    effect(() => this.feed.load(this.repo(), this.number()));
  }

  protected dateOf(iso: string): string {
    return shortDate(iso, this.now().getTime());
  }
}
