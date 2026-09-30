import {
  DOCUMENT,
  Injectable,
  Signal,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Clock } from '../time/clock';
import { TrailActivity } from '../sky/trail-activity';
import { localDayKey } from '../usage/usage-format';
import { REPLY_VOICE } from '../voice/reply-voice';
import { SpeakPreference } from '../voice/speak-preference';
import { AgentUsageFeed } from './agent-usage-feed';
import { Nudge, NudgeKind, agentNudges } from './agent-nudges';
import {
  FRIDAY,
  NO_REVIEWS,
  ReviewState,
  Weekday,
  dueWeek,
  markDone,
  snoozeToMonday,
} from './agent-review-week';

/** When the weekly review falls (null: reminders off), and whether to notify outside the tab. */
export interface ReminderSettings {
  readonly day: Weekday | null;
  readonly notify: boolean;
}

const DEFAULT_SETTINGS: ReminderSettings = { day: FRIDAY, notify: false };
const SETTINGS_KEY = 'observatory.agent-reminders';
const REVIEW_KEY = 'observatory.agent-review';
const DISMISSED_KEY = 'observatory.agent-nudges';

export const REVIEW_WORDS =
  'Agent review is due: tokens by day for the week, then who spends the tokens, then how full each context gets.';

/** Private windows and blocked site data throw here; the default then holds. */
function readStored<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return valid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

/** Where storage is blocked the choice lasts for this visit only. */
function store(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isSettings = (value: unknown): value is ReminderSettings =>
  isObject(value) &&
  (value['day'] === null ||
    (Number.isInteger(value['day']) && Number(value['day']) >= 0 && Number(value['day']) <= 6)) &&
  typeof value['notify'] === 'boolean';
const isReview = (value: unknown): value is ReviewState & { announced?: string } =>
  isObject(value) && Array.isArray(value['done']);
const isDismissed = (value: unknown): value is { day: string; kinds: NudgeKind[] } =>
  isObject(value) && typeof value['day'] === 'string' && Array.isArray(value['kinds']);

/** The weekly Agent review and the nudges from the agent runs, with the owner's
 *  choices about them remembered in this browser. */
@Injectable({ providedIn: 'root' })
export class AgentReminders {
  private readonly clock = inject(Clock).now;
  /** The time to the minute: the clock ticks every second, and nothing here needs that. */
  private readonly minute = computed(() => Math.floor(this.clock().getTime() / 60_000) * 60_000);
  private readonly runs = inject(AgentUsageFeed).runs;
  private readonly pace = inject(TrailActivity).measured;
  private readonly speakOn = inject(SpeakPreference).isOn;
  private readonly voice = inject(REPLY_VOICE);
  private readonly document = inject(DOCUMENT);

  private readonly chosen = signal(readStored(SETTINGS_KEY, DEFAULT_SETTINGS, isSettings));
  private readonly review = signal(
    readStored(REVIEW_KEY, { ...NO_REVIEWS, announced: '' }, isReview),
  );
  private readonly dismissed = signal(
    readStored(DISMISSED_KEY, { day: '', kinds: [] }, isDismissed),
  );
  private readonly today = computed(() => localDayKey(this.minute()));

  readonly settings: Signal<ReminderSettings> = this.chosen.asReadonly();
  /** The week whose review the card shows, or null. */
  readonly due: Signal<string | null> = computed(() => {
    const { day } = this.chosen();
    return day === null ? null : dueWeek(this.minute(), day, this.review());
  });
  readonly nudges: Signal<readonly Nudge[]> = computed(() => {
    if (this.chosen().day === null) return [];
    const { day, kinds } = this.dismissed();
    const today = this.today();
    const resting = new Set<NudgeKind>(day === today ? kinds : []);
    return agentNudges(this.runs(), this.pace(), this.minute(), today, resting);
  });

  constructor() {
    // The card is announced once a week: aloud if Speak is on, and by the
    // browser if the owner asked and the tab is in the background.
    effect(() => {
      const week = this.due();
      if (!week || untracked(this.review).announced === week) return;
      untracked(() => this.announce(week));
    });
  }

  setDay(day: Weekday | null): void {
    this.saveSettings({ ...this.chosen(), day });
  }

  /** Asks the browser for leave first; a refusal leaves it off. */
  async setNotify(notify: boolean): Promise<void> {
    if (notify && !(await this.permitted())) notify = false;
    this.saveSettings({ ...this.chosen(), notify });
  }

  done(): void {
    const week = this.due();
    if (week) this.saveReview({ ...this.review(), ...markDone(this.review(), week) });
  }

  snooze(): void {
    const week = this.due();
    if (week) {
      this.saveReview({ ...this.review(), ...snoozeToMonday(this.review(), week, this.minute()) });
    }
  }

  /** Rests the nudge's kind until tomorrow. */
  dismiss(kind: NudgeKind): void {
    const today = this.today();
    const { day, kinds } = this.dismissed();
    const next = { day: today, kinds: [...(day === today ? kinds : []), kind] };
    this.dismissed.set(next);
    store(DISMISSED_KEY, next);
  }

  private saveSettings(settings: ReminderSettings): void {
    this.chosen.set(settings);
    store(SETTINGS_KEY, settings);
  }

  private saveReview(review: ReviewState & { announced?: string }): void {
    this.review.set(review);
    store(REVIEW_KEY, review);
  }

  private announce(week: string): void {
    this.saveReview({ ...this.review(), announced: week });
    if (this.speakOn()) void this.voice.speak(REVIEW_WORDS, 1);
    const Notice = this.document.defaultView?.Notification;
    if (this.chosen().notify && this.document.hidden && Notice?.permission === 'granted') {
      new Notice('Agent review', { body: REVIEW_WORDS, tag: `agent-review-${week}` });
    }
  }

  private async permitted(): Promise<boolean> {
    const Notice = this.document.defaultView?.Notification;
    if (!Notice) return false;
    if (Notice.permission === 'granted') return true;
    if (Notice.permission === 'denied') return false;
    return (await Notice.requestPermission()) === 'granted';
  }
}
