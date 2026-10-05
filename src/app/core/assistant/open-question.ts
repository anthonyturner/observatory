import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, timer } from 'rxjs';
import { wholeMinutes } from '../runs/run-words';
import { OpenItem } from './open-items';

/** How long a question waits for an answer before it closes itself. */
export const QUESTION_MS = 120_000;

export const TIMED_OUT_NOTE = `No answer in ${wholeMinutes(QUESTION_MS)} minutes, so the question closed.`;

/** Jev's offer to open what he just announced. */
export interface AskedQuestion {
  readonly id: number;
  /** As Jev said it: "Would you like to open any of them?". */
  readonly words: string;
  readonly items: readonly OpenItem[];
  readonly hasTimedOut: boolean;
}

/** The one question on show on Home, if any. It is asked only while Home's
 *  Ask panel is on screen, since nowhere else can show it or hear an answer. */
@Injectable({ providedIn: 'root' })
export class OpenQuestion {
  private readonly destroyRef = inject(DestroyRef);
  private readonly asked = signal<AskedQuestion | null>(null);
  private readonly isPanelShown = signal(false);
  private expiry = Subscription.EMPTY;
  private askedCount = 0;

  readonly question = this.asked.asReadonly();
  /** True while a question can still be answered; a timed-out one cannot. */
  readonly isWaiting = computed(() => this.asked()?.hasTimedOut === false);
  readonly canAsk = this.isPanelShown.asReadonly();

  /** Puts up a new question in place of any other. */
  ask(words: string, items: readonly OpenItem[]): void {
    this.close();
    this.asked.set({ id: ++this.askedCount, words, items, hasTimedOut: false });
    this.expiry = timer(QUESTION_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.timeOut());
  }

  close(): void {
    this.expiry.unsubscribe();
    this.asked.set(null);
  }

  panelArrived(): void {
    this.isPanelShown.set(true);
  }

  /** Leaving Home closes the question with it. */
  panelLeft(): void {
    this.isPanelShown.set(false);
    this.close();
  }

  private timeOut(): void {
    this.asked.update((question) => question && { ...question, hasTimedOut: true });
  }
}
