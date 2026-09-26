import { DestroyRef, Injectable, Injector, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AskFeed } from '../../assistant/ask-feed';
import { AskOutcome } from '../../assistant/ask-outcome';
import { ANSWERED_HOLD_MS, ERROR_HOLD_MS } from '../core-holds';
import { CORE_STATE_WRITER } from '../core-state-tokens';
import { CoreStateSource } from '../core-state.types';

const ANSWERED = { 1: 'answered-1', 2: 'answered-2', 3: 'answered-3' } as const;

/** The Ask feed on the core: working while a request is out, then the tier
 *  it was answered at, or an error. */
@Injectable()
export class AskCoreSource implements CoreStateSource {
  private readonly feed = inject(AskFeed);
  private readonly writer = inject(CORE_STATE_WRITER);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  connect(): void {
    effect(
      () => {
        if (this.feed.busy()) untracked(() => this.writer.show('routing'));
      },
      { injector: this.injector },
    );
    this.feed.outcomes
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((outcome) => this.showOutcome(outcome));
  }

  private showOutcome(outcome: AskOutcome): void {
    if (outcome.kind === 'answered') this.writer.flash(ANSWERED[outcome.tier], ANSWERED_HOLD_MS);
    else if (outcome.kind === 'failed') this.writer.flash('error', ERROR_HOLD_MS);
    else this.writer.show('idle');
  }
}
