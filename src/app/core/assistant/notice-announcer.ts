import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ActivityWatch } from '../activity/activity-watch';
import { ActivityItem } from '../activity/activity.types';
import { sayingOf } from '../notices/notice-words';
import { PageVisibility } from '../presence/page-visibility';
import { ANNOUNCEMENT_VOICE } from '../voice/announcement-voice';
import { SpeakPreference } from '../voice/speak-preference';
import { TalkState } from '../voice/talk-state';
import { ASK_CHANNEL } from './ask-channel';
import { ProposalSlot } from './proposal';

/**
 * Jev says each check's news aloud, in one line, with Speak on and the tab in
 * view. News that comes while he is busy (reading a line, hearing the mic, on
 * a request, or showing a task) is held and joined by any that follows, then
 * said once he is free. News while the tab is hidden, or Speak is off, is not
 * said at all. Made only on this machine: see provideNoticeAnnouncer.
 */
@Injectable({ providedIn: 'root' })
export class NoticeAnnouncer {
  private readonly voice = inject(ANNOUNCEMENT_VOICE);
  private readonly speakOn = inject(SpeakPreference).isOn;
  private readonly hidden = inject(PageVisibility).isHidden;
  private readonly talking = inject(TalkState).isTalking;
  private readonly asking = inject(ASK_CHANNEL).busy;
  private readonly proposal = inject(ProposalSlot).proposal;
  private readonly held = signal<readonly ActivityItem[]>([]);

  private readonly canHear = computed(() => this.speakOn() && !this.hidden());
  private readonly isIdle = computed(
    () => !this.voice.isBusy() && !this.talking() && !this.asking() && this.proposal() === null,
  );
  private readonly isDue = computed(
    () => this.canHear() && this.isIdle() && this.held().length > 0,
  );

  constructor() {
    inject(ActivityWatch)
      .checks.pipe(takeUntilDestroyed())
      .subscribe((items) => this.hold(items));
    toObservable(this.canHear)
      .pipe(
        filter((canHear) => !canHear),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.held.set([]));
    toObservable(this.isDue)
      .pipe(filter(Boolean), takeUntilDestroyed())
      .subscribe(() => this.sayHeld());
  }

  private hold(items: readonly ActivityItem[]): void {
    if (this.canHear()) this.held.update((held) => [...held, ...items]);
  }

  private sayHeld(): void {
    if (!this.isDue()) return;
    const items = this.held();
    this.held.set([]);
    this.voice.announce(sayingOf(items));
  }
}
