import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ActivityWatch } from '../activity/activity-watch';
import { ActivityItem } from '../activity/activity.types';
import { AgentQuiet } from '../agent-speech/agent-quiet';
import { NewMail } from '../mail/mail-memory';
import { MailWatch } from '../mail/mail-watch';
import { mailSayingOf } from '../notices/mail-words';
import { sayingOf } from '../notices/notice-words';
import { PageVisibility } from '../presence/page-visibility';
import { ANNOUNCEMENT_VOICE } from '../voice/announcement-voice';
import { SpeakPreference } from '../voice/speak-preference';
import { TalkState } from '../voice/talk-state';
import { VoiceChoice } from '../voice/voice-choice';
import { ASK_CHANNEL } from './ask-channel';
import { openItemsOf, questionOf } from './open-items';
import { OpenQuestion } from './open-question';
import { ProposalSlot } from './proposal';

/** What Jev has yet to say: the projects' news, then new mail. */
interface Held {
  readonly items: readonly ActivityItem[];
  readonly mail: readonly NewMail[];
}

const NOTHING_HELD: Held = { items: [], mail: [] };

/**
 * Jev says each check's news, and new mail, aloud in one line, with Speak on
 * and the tab in view. News that comes while he is busy (reading a line,
 * hearing the mic, on a request, or showing a task), or while Agent Speak is
 * talking, is held and joined by any that follows, then said once both are
 * quiet. News while the tab is hidden, or Speak is off, is not said at all. A
 * refused mail sign-in is never said. With Home's Ask panel on screen, a line
 * naming open pull requests or issues ends by asking whether to open them, and
 * later news waits until that question is answered or gone.
 * Made only on this machine: see provideNoticeAnnouncer.
 */
@Injectable({ providedIn: 'root' })
export class NoticeAnnouncer {
  private readonly voice = inject(ANNOUNCEMENT_VOICE);
  private readonly speakOn = inject(SpeakPreference).isOn;
  private readonly hidden = inject(PageVisibility).isHidden;
  private readonly talking = inject(TalkState).isTalking;
  private readonly asking = inject(ASK_CHANNEL).busy;
  private readonly proposal = inject(ProposalSlot).proposal;
  private readonly question = inject(OpenQuestion);
  /** Only a voice that keeps its words here may name a sender or subject. */
  private readonly mayNameMail = inject(VoiceChoice).isOnThisMachine;
  private readonly held = signal<Held>(NOTHING_HELD);

  private readonly canHear = computed(() => this.speakOn() && !this.hidden());
  private readonly isJevIdle = computed(
    () =>
      !this.voice.isBusy() &&
      !this.talking() &&
      !this.asking() &&
      this.proposal() === null &&
      !this.question.isWaiting(),
  );
  private readonly hasHeld = computed(
    () => this.held().items.length > 0 || this.held().mail.length > 0,
  );
  /** Agent Speak is asked about only while news waits on it alone. */
  private readonly isWaitingOnAgent = computed(
    () => this.canHear() && this.isJevIdle() && this.hasHeld(),
  );
  private readonly isAgentQuiet = toSignal(
    inject(AgentQuiet).whileWaiting(toObservable(this.isWaitingOnAgent)),
    { initialValue: false },
  );
  private readonly isDue = computed(() => this.isWaitingOnAgent() && this.isAgentQuiet());

  constructor() {
    inject(ActivityWatch)
      .checks.pipe(takeUntilDestroyed())
      .subscribe((items) => this.hold({ items, mail: [] }));
    inject(MailWatch)
      .news.pipe(takeUntilDestroyed())
      .subscribe(({ newMail }) => this.hold({ items: [], mail: newMail }));
    toObservable(this.canHear)
      .pipe(
        filter((canHear) => !canHear),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.held.set(NOTHING_HELD));
    toObservable(this.isDue)
      .pipe(filter(Boolean), takeUntilDestroyed())
      .subscribe(() => this.sayHeld());
  }

  private hold(news: Held): void {
    if (!this.canHear()) return;
    this.held.update(({ items, mail }) => ({
      items: [...items, ...news.items],
      mail: [...mail, ...news.mail],
    }));
  }

  /** The voice is read as the line is made, so a change of voice since the news came counts.
   *  The card goes up as the line starts, so it can be answered before the line ends. */
  private sayHeld(): void {
    if (!this.isDue()) return;
    const { items, mail } = this.held();
    this.held.set(NOTHING_HELD);
    const open = this.question.canAsk() ? openItemsOf(items) : [];
    const asking = open.length ? questionOf(open, mail.length > 0) : null;
    const lines = [
      ...(items.length ? [sayingOf(items)] : []),
      ...(mail.length ? [mailSayingOf(mail, this.mayNameMail())] : []),
      ...(asking ? [asking] : []),
    ];
    this.voice.announce(lines.join(' '));
    if (asking) this.question.ask(asking, open);
  }
}
