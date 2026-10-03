import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ActivityWatch } from '../activity/activity-watch';
import { ACTIVITY_KINDS, ActivityItem, ActivityKind } from '../activity/activity.types';
import { MailNews } from '../mail/mail-memory';
import { MailWatch } from '../mail/mail-watch';
import { PageVisibility } from '../presence/page-visibility';
import { mailAnnouncementOf } from './mail-words';
import { NoticeCountdowns } from './notice-countdowns';
import { noticeDurationMs } from './notice-timing';
import { announcementOf } from './notice-words';
import { ActivityNotice, Countdown, Notice, NoticeContent } from './notice.types';

/** The stack holds at most this many; the oldest leaves for a new one. */
export const MOST_NOTICES = 3;

const rowsOf = (content: NoticeContent): number => {
  switch (content.kind) {
    case 'mail':
      return content.messages.length;
    case 'mail-sign-in':
      return 1;
    default:
      return content.items.length;
  }
};

/**
 * The notices on show on every page, from the activity watch and the mail
 * watch: one per kind per check, and one per account per mail read, oldest
 * first. Each leaves on its own when its countdown ends; every countdown waits
 * while the pointer is over the stack, focus is in it, or the tab is hidden.
 */
@Injectable({ providedIn: 'root' })
export class NoticeBoard {
  private readonly visibility = inject(PageVisibility);
  private readonly shown = signal<readonly Notice[]>([]);
  private readonly spoken = signal('');
  private readonly pointerOver = signal(false);
  private readonly focusWithin = signal(false);
  /** Notices that arrived while the tab was hidden; later news of their kind joins them. */
  private readonly unseen = new Set<number>();
  private nextId = 1;

  readonly notices: Signal<readonly Notice[]> = this.shown.asReadonly();
  /** The latest check's news in one sentence, for the polite live region. */
  readonly announcement: Signal<string> = this.spoken.asReadonly();
  readonly isPaused: Signal<boolean> = computed(
    () => this.pointerOver() || this.focusWithin() || this.visibility.isHidden(),
  );

  private readonly timers = new NoticeCountdowns({
    isPaused: () => this.isPaused(),
    expire: (id) => this.dismiss(id),
    now: () => Date.now(),
  });

  readonly countdowns: Signal<ReadonlyMap<number, Countdown>> = this.timers.countdowns;

  constructor() {
    inject(ActivityWatch)
      .checks.pipe(takeUntilDestroyed())
      .subscribe((items) => this.show(items));
    inject(MailWatch)
      .news.pipe(takeUntilDestroyed())
      .subscribe((news) => this.showMail(news));
    toObservable(this.isPaused)
      .pipe(takeUntilDestroyed())
      .subscribe((isPaused) => (isPaused ? this.timers.pause() : this.timers.resume()));
    toObservable(this.visibility.isHidden)
      .pipe(
        filter((isHidden) => !isHidden),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.unseen.clear());
    inject(DestroyRef).onDestroy(() => this.timers.stopAll());
  }

  dismiss(id: number): void {
    this.timers.stop(id);
    this.unseen.delete(id);
    this.shown.update((notices) => notices.filter((notice) => notice.id !== id));
    if (this.shown().length) return;
    // Nothing is left to leave or blur, so neither event will come.
    this.pointerOver.set(false);
    this.focusWithin.set(false);
  }

  setPointerOver(isOver: boolean): void {
    this.pointerOver.set(isOver);
  }

  setFocusWithin(isWithin: boolean): void {
    this.focusWithin.set(isWithin);
  }

  /** A check with more kinds than the stack holds shows only the first few,
   *  rather than pushing out its own merged pull requests; the announcement
   *  still counts every item. */
  private show(items: readonly ActivityItem[]): void {
    this.spoken.set(announcementOf(items));
    const kinds = ACTIVITY_KINDS.filter((kind) => items.some((item) => item.kind === kind));
    for (const kind of kinds.slice(0, MOST_NOTICES)) {
      this.place(
        kind,
        items.filter((item) => item.kind === kind),
      );
    }
    this.trim();
  }

  /** Mail is read only while the tab is in view, so its notices never wait to join. */
  private showMail(news: MailNews): void {
    this.spoken.set(mailAnnouncementOf(news));
    for (const { account, messages } of news.newMail) this.add({ kind: 'mail', account, messages });
    for (const account of news.signInFailed) this.add({ kind: 'mail-sign-in', account });
    this.trim();
  }

  private trim(): void {
    while (this.shown().length > MOST_NOTICES) this.dismiss(this.shown()[0].id);
  }

  private place(kind: ActivityKind, items: readonly ActivityItem[]): void {
    const unseenOfKind = this.visibility.isHidden()
      ? this.shown().find(
          (notice): notice is ActivityNotice => notice.kind === kind && this.unseen.has(notice.id),
        )
      : undefined;
    if (unseenOfKind) this.join(unseenOfKind, items);
    else this.add({ kind, items });
  }

  private add(content: NoticeContent): void {
    const notice: Notice = { ...content, id: this.nextId++ };
    this.shown.update((notices) => [...notices, notice]);
    if (this.visibility.isHidden()) this.unseen.add(notice.id);
    this.timers.start(notice.id, noticeDurationMs(rowsOf(content)));
  }

  /** Joins a notice still waiting for the tab, so its countdown has not yet run. */
  private join(notice: ActivityNotice, items: readonly ActivityItem[]): void {
    const joined: ActivityNotice = { ...notice, items: [...notice.items, ...items] };
    this.shown.update((notices) => notices.map((each) => (each.id === notice.id ? joined : each)));
    this.timers.start(notice.id, noticeDurationMs(joined.items.length));
  }
}
