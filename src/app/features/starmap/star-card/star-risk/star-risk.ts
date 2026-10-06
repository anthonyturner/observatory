import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RiskGlanceFeed } from '../../../../core/queue/risk-glance-feed';

/**
 * A pull request's risk at a glance on its star card: a low, medium or high
 * tag from the files it changes, what raised it, and a one-line summary when
 * the server has an AI key. Shows nothing until the rules are in.
 */
@Component({
  selector: 'app-star-risk',
  templateUrl: './star-risk.html',
  styleUrl: './star-risk.css',
  providers: [RiskGlanceFeed],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarRisk {
  readonly repo = input.required<string>();
  readonly number = input.required<number>();

  private readonly feed = inject(RiskGlanceFeed);

  protected readonly view = computed(() => {
    const state = this.feed.state();
    return state.status === 'ready' ? state.view : null;
  });

  constructor() {
    effect(() => this.feed.load(this.repo(), this.number()));
  }
}
