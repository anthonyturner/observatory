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
import { BROWSER_NOTICES } from './browser-notices';

/** When the weekly review falls (null: reminders off), and whether to notify outside the tab. */
export interface ReminderSettings {
  readonly day: Weekday | null;
  readonly notify: boolean;
}

/** The review state, and which showing of the card was last announced. */
interface StoredReview extends ReviewState {
  readonly announced: string;
}

const DEFAULT_SETTINGS: ReminderSettings = { day: FRIDAY, notify: false };
const SETTINGS_KEY = 'observatory.agent-reminders';
const REVIEW_KEY = 'observatory.agent-review';
const DISMISSED_KEY = 'observatory.agent-nudges';
const NUDGE_KINDS: readonly NudgeKind[] = [
  'near-limit',
  'busy-day',
  'pricier',
  'rework',
  'skipped-qa',
];

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
const isText = (value: unknown): value is string => typeof value === 'string';
const isSettings = (value: unknown): value is ReminderSettings =>
  isObject(value) &&
  (value['day'] === null ||
    (Number.isInteger(value['day']) && Number(value['day']) >= 0 && Number(value['day']) <= 6)) &&
  typeof value['notify'] === 'boolean';
const isSnooze = (value: unknown): boolean =>
  value === null || (isObject(value) && isText(value['week']) && Number.isFinite(value['until']));
const isReview = (value: unknown): value is StoredReview =>
  isObject(value) &&
  Array.isArray(value['done']) &&
  value['done'].every(isText) &&
  isSnooze(value['snooze']) &&
  isText(value['announced']);
const isDismissed = (value: unknown): value is { day: string; kinds: NudgeKind[] } =>
  isObject(value) &&
  isText(value['day']) &&
  Array.isArray(value['kinds']) &&
  value['kinds'].every((kind) => NUDGE_KINDS.includes(kind as NudgeKind));

/** Which showing of the card this is: a review brought back from Monday's snooze
 *  is a showing of its own, so it is announced again. */
function showingOf(week: string, review: ReviewState): string {
  const { snooze } = review;
  return snooze?.week === week ? `${week}@${snooze.until}` : week;
}

/** The weekly Agent review and the nudges from the agent runs, with the owner's
 *  choices about them remembered in this browser. */
@Injectable({ providedIn: 'root' })
export class AgentReminders {
  private readonly clock = inject(Clock).now;
  /** The time to the minute: the clock ticks every second, and nothing here needs that. */
  private readonly minute = computed(() => Math.floor(this.clock().getTime() / 60_000) * 60_000);
  private readonly runs = inject(AgentUsageFeed).runs;
  private readonly busyRatio = inject(TrailActivity).ratio;
  private readonly speakOn = inject(SpeakPreference).isOn;
  private readonly voice = inject(REPLY_VOICE);
  private readonly notices = inject(BROWSER_NOTICES);
  private readonly document = inject(DOCUMENT);

  private readonly chosen = signal(readStored(SETTINGS_KEY, DEFAULT_SETTINGS, isSettings));
  private readonly review = signal<StoredReview>(
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
  /** The card's current showing, which is announced once. */
  private readonly showing = computed(
    () => {
      const week = this.due();
      return week ? { week, key: showingOf(week, this.review()) } : null;
    },
    { equal: (a, b) => a?.key === b?.key },
  );
  readonly nudges: Signal<readonly Nudge[]> = computed(() => {
    if (this.chosen().day === null) return [];
    const { day, kinds } = this.dismissed();
    const today = this.today();
    const resting = new Set<NudgeKind>(day === today ? kinds : []);
    return agentNudges(this.runs(), this.busyRatio(), this.minute(), today, resting);
  });

  constructor() {
    // Each showing of the card is announced once: aloud if Speak is on, and by
    // the browser if the owner asked and the tab is in the background.
    effect(() => {
      const showing = this.showing();
      if (!showing || untracked(this.review).announced === showing.key) return;
      untracked(() => this.announce(showing.week, showing.key));
    });
  }

  setDay(day: Weekday | null): void {
    this.saveSettings({ ...this.chosen(), day });
  }

  /** Asks the browser first, only when turned on; a refusal leaves it off. */
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

  private saveReview(review: StoredReview): void {
    this.review.set(review);
    store(REVIEW_KEY, review);
  }

  private announce(week: string, showing: string): void {
    this.saveReview({ ...this.review(), announced: showing });
    if (this.speakOn()) void this.voice.speak(REVIEW_WORDS, 1);
    const wanted = this.chosen().notify && this.document.hidden;
    if (wanted && this.notices.permission() === 'granted') {
      this.notices.show('Agent review', REVIEW_WORDS, `agent-review-${week}`);
    }
  }

  private async permitted(): Promise<boolean> {
    const permission = this.notices.permission();
    if (permission === 'granted') return true;
    if (permission !== 'default') return false;
    return this.notices.request();
  }
}
