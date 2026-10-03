import { Injectable, Signal, computed, signal } from '@angular/core';

/** A page's score as the playlist sees it: whether it plays, and its switch. */
export interface Score {
  readonly isOn: Signal<boolean>;
  toggle(): void;
}

/** The score of the page on show. Each page provides its own score, but the playlist
 *  outlives pages, so the score registers here for the two never to play at once. */
@Injectable({ providedIn: 'root' })
export class PageScore {
  private readonly live = signal<Score | null>(null);

  readonly isOn = computed(() => this.live()?.isOn() ?? false);

  register(score: Score): void {
    this.live.set(score);
  }

  /** A page's score leaving; a later page that already registered keeps its place. */
  unregister(score: Score): void {
    if (this.live() === score) this.live.set(null);
  }

  /** Turns the page's score off, if it plays. */
  silence(): void {
    const score = this.live();
    if (score?.isOn()) score.toggle();
  }
}
