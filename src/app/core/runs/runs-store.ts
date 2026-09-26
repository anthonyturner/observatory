import {
  DOCUMENT,
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { AssistantInfo } from '../assistant/assistant-info';
import { ReplySpeech } from '../assistant/reply-speech';
import { ViewerSession } from '../session/viewer-session';
import { Clock } from '../time/clock';
import { PastRuns } from './past-runs';
import { RunAnnouncer } from './run-announcer';
import { RunCache, RunLines } from './run-cache';
import { FollowListener, RunFollower } from './run-follower';
import { LOST_STREAM, PICKED_UP_FRESH, PICKED_UP_KEPT, endNoteOf } from './run-notes';
import { RunRecord } from './run-record';
import { MS_PER_MINUTE, RUN_MILESTONES, RunLinkState } from './run-words';
import { RUNS_API, messageOf } from './runs-api';
import { parseRunEvent } from './runs-parse';
import { RunEvent, RunSummary, RunsReport, StartRequest, isEndedState } from './runs.types';

/** A refused tool is said aloud only while it is news, not on a replay. */
const FRESH_REFUSAL_MS = 10_000;
const WARN_LEFT_MS = 5 * MS_PER_MINUTE;
const LAST_MINUTE_MS = MS_PER_MINUTE;

const NO_RUNS: RunsReport = { current: null, recent: [] };

/** The note a run picked up from the runner opens with, by whether this tab
 *  had kept what it read of it. */
type PickUpNote = (isKept: boolean) => string | null;

const SAY_PICKED_UP: PickUpNote = (isKept) => (isKept ? PICKED_UP_KEPT : PICKED_UP_FRESH);
const SAY_NOTHING: PickUpNote = () => null;

/** How a run is opened: the note it starts with, and the lines this tab had
 *  already read of it before a reload. */
interface RunOpening {
  readonly note?: string | null;
  readonly cached?: readonly string[] | null;
}

/** The run followed now, with what follows it and what it keeps for a reload. */
interface Followed {
  readonly record: RunRecord;
  readonly follower: RunFollower;
  readonly lines: RunLines;
}

/**
 * The run this page follows: the runner's current run, or the last one this
 * page followed. The runner holds the run and numbers its events, so a
 * reload, a second tab or a dropped connection picks it up again where it left
 * off; the page only follows it.
 */
@Injectable({ providedIn: 'root' })
export class RunsStore {
  private readonly api = inject(RUNS_API);
  private readonly info = inject(AssistantInfo);
  private readonly session = inject(ViewerSession);
  private readonly speech = inject(ReplySpeech);
  private readonly clock = inject(Clock);
  private readonly cache = inject(RunCache);
  private readonly past = inject(PastRuns);
  private readonly announcer = inject(RunAnnouncer);
  private readonly following = signal<Followed | null>(null);
  private readonly report = signal<RunsReport>(NO_RUNS);
  private readonly cancelling = signal(false);
  private wasLive = false;

  /** Only the local site runs tasks, and only for its owner. */
  readonly isAvailable = computed(
    () => this.info.where() === 'local' && !this.session.isVisitor() && !this.info.isRefused(),
  );
  readonly followed = computed(() => this.following()?.record ?? null);
  readonly isLive = computed(() => this.followed()?.isLive() ?? false);
  /** The runner's list, for Recent runs and the pill. */
  readonly list = this.report.asReadonly();
  readonly isCancelling = this.cancelling.asReadonly();

  constructor() {
    effect(() => {
      const now = this.clock.now().getTime();
      untracked(() => this.warnNearLimit(now));
    });
    const view = inject(DOCUMENT).defaultView;
    const keep = (): void => this.keepForReload();
    view?.addEventListener('pagehide', keep);
    inject(DestroyRef).onDestroy(() => view?.removeEventListener('pagehide', keep));
  }

  /** Starts the run a proposal describes, and follows it. */
  async start(request: StartRequest): Promise<void> {
    this.open(await this.api.start(request));
  }

  /** Picks up the run the runner is on after a reload, saying so. */
  async pickUp(): Promise<void> {
    const report = await this.load();
    if (report?.current) this.openCurrent(report.current, SAY_PICKED_UP);
  }

  /** Reads the runner's list again, and follows its run if this page is not. */
  async refresh(): Promise<void> {
    const report = await this.load();
    if (report?.current) this.openCurrent(report.current, SAY_NOTHING);
  }

  open(summary: RunSummary, opening: RunOpening = {}): void {
    this.following()?.follower.stop();
    const record = new RunRecord(summary);
    const lines = new RunLines();
    const from = this.replay(record, lines, opening.cached ?? []);
    record.hearState(summary.state);
    const follower = new RunFollower(this.api, {
      id: summary.id,
      from,
      listener: this.listenerFor(record, lines),
    });
    this.following.set({ record, follower, lines });
    record.setNote(opening.note ? { text: opening.note, isBad: false, action: null } : null);
    this.setState(record, summary.state);
    follower.start();
  }

  async cancel(): Promise<void> {
    const record = this.followed();
    if (!record?.isLive()) return;
    this.cancelling.set(true);
    try {
      await this.api.cancel(record.id);
      if (this.followed() === record && record.isLive()) this.setState(record, 'stopping');
    } catch (error: unknown) {
      record.setNote({
        text: `Couldn’t cancel the run: ${messageOf(error)}.`,
        isBad: true,
        action: null,
      });
    } finally {
      this.cancelling.set(false);
    }
  }

  /** Stops following a finished run. It stays readable from Recent runs
   *  without asking the runner again. */
  close(): void {
    const followed = this.following();
    if (!followed) return;
    followed.follower.stop();
    this.past.keep(followed.record);
    this.following.set(null);
  }

  private async load(): Promise<RunsReport | null> {
    try {
      const report = await this.api.list();
      this.report.set(report);
      return report;
    } catch {
      return null;
    }
  }

  /** Opens `current` unless it is the run followed already. A reload in this
   *  tab starts from what the tab had already read. */
  private openCurrent(current: RunSummary, noteFor: PickUpNote): void {
    if (current.id === this.followed()?.id) return;
    const cached = this.cache.read(current.id);
    this.cache.clear();
    this.open(current, { note: noteFor(cached !== null), cached });
  }

  /** Reads what this tab had kept; returns the first event it still needs. */
  private replay(record: RunRecord, lines: RunLines, cached: readonly string[]): number {
    const events: RunEvent[] = [];
    for (const line of cached) {
      const event = parseRunEvent(line);
      if (!event) continue;
      events.push(event);
      lines.add(line);
    }
    record.replay(events);
    return (events.at(-1)?.n ?? -1) + 1;
  }

  private listenerFor(record: RunRecord, lines: RunLines): FollowListener {
    return {
      event: (event: RunEvent, line: string) => this.hear(record, lines, event, line),
      reconnecting: () => this.setState(record, 'reconnecting'),
      lost: () => this.lose(record),
      gone: () => {
        record.hearState('shutdown');
        this.setState(record, 'shutdown');
      },
      hasEnded: () => isEndedState(record.state()),
    };
  }

  private hear(record: RunRecord, lines: RunLines, event: RunEvent, line: string): void {
    if (this.followed() !== record) return;
    const refusedBefore = record.facts().refused;
    lines.add(line);
    record.read(event);
    if (record.state() !== record.serverState) this.setState(record, record.serverState);
    const facts = record.facts();
    const isFresh = this.clock.now().getTime() - event.at < FRESH_REFUSAL_MS;
    if (facts.refused > refusedBefore && isFresh) {
      this.announcer.say(
        record.id,
        `Not allowed: ${facts.lastRefused}. ${facts.refused} refused so far.`,
      );
    }
  }

  private lose(record: RunRecord): void {
    this.setState(record, 'lost');
    const reconnect = (): void => {
      record.setNote(null);
      this.setState(record, 'reconnecting');
      this.following()?.follower.reconnect();
    };
    record.setNote({
      text: LOST_STREAM,
      isBad: true,
      action: { label: 'Reconnect', press: reconnect },
    });
  }

  private setState(record: RunRecord, state: RunLinkState): void {
    const was = record.state();
    record.setState(state);
    const isLive = record.isLive();
    // A run outranks a reply: its start cuts the reply off.
    if (isLive && !this.wasLive) this.speech.stop();
    this.wasLive = isLive;
    if (was === state) return;
    if (isEndedState(state)) {
      record.setNote(endNoteOf(record.ending(), this.clock.now().getTime()));
      void this.refresh();
    }
    this.announcer.say(record.id, RUN_MILESTONES[record.shownState()]);
  }

  private warnNearLimit(now: number): void {
    const record = this.followed();
    if (!record?.isLive()) return;
    const left = record.limitMs - Math.max(0, now - record.startedAt);
    if (left > WARN_LEFT_MS) return;
    const words =
      left <= LAST_MINUTE_MS ? 'One minute left on the task.' : 'Five minutes left on the task.';
    this.announcer.say(record.id, words);
  }

  private keepForReload(): void {
    const followed = this.following();
    if (followed?.record.isLive() && followed.lines.lines.length) {
      this.cache.keep(followed.record.id, followed.lines.lines);
    } else {
      this.cache.clear();
    }
  }
}
