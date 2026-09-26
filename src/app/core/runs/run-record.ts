import { WritableSignal, computed, signal } from '@angular/core';
import { Json, fieldOf, isNumber, isObject, isText, oneOf } from '../json/json-fields';
import { RunEnding } from './run-notes';
import { RunLinkState, RunShownState } from './run-words';
import { RUN_STATES, RunEvent, RunResult, RunState, RunSummary, isEndedState } from './runs.types';
import { Transcript } from './transcript/transcript';
import { NO_FACTS, TranscriptEntry, TranscriptFacts } from './transcript/transcript.types';

/** A button on a run's note, such as Reconnect. */
export interface NoteAction {
  readonly label: string;
  readonly press: () => void;
}

/** The line under a run's prompt: how it ended, or a lost stream. */
export interface RunNote {
  readonly text: string;
  readonly isBad: boolean;
  readonly action: NoteAction | null;
}

/**
 * One run as the page holds it: the runner's summary, kept up to date by its
 * events, and its transcript. Each part a template reads is a signal.
 */
export class RunRecord {
  readonly id: string;
  readonly prompt: string;
  readonly folder: string;
  readonly name: string;
  readonly startedAt: number;
  readonly limitMs: number;
  /** The last state the runner sent, which the page's may lag behind. */
  private heard: RunState;
  private readonly transcript: Transcript;
  private readonly linkState: WritableSignal<RunLinkState>;
  private readonly ended: WritableSignal<number | null>;
  private readonly whyText: WritableSignal<string | null>;
  private readonly verdict: WritableSignal<RunResult | null>;
  private readonly noted = signal<RunNote | null>(null);
  private readonly shownEntries = signal<readonly TranscriptEntry[]>([]);
  private readonly learned = signal<TranscriptFacts>(NO_FACTS);

  readonly state;
  readonly endedAt;
  readonly why;
  readonly result;
  readonly note = this.noted.asReadonly();
  readonly entries = this.shownEntries.asReadonly();
  readonly facts = this.learned.asReadonly();
  /** Starting, running, stopping, or its stream is being picked up again. */
  readonly isLive = computed(() => !isEndedState(this.linkState()));
  /** Claude Code can end cleanly with an error of its own, so its verdict,
   *  not its exit code, says done. */
  readonly shownState = computed<RunShownState>(() => {
    const state = this.linkState();
    const isErrored = this.verdict()?.error === true || this.learned().hasFailed;
    return state === 'done' && isErrored ? 'errored' : state;
  });

  constructor(summary: RunSummary) {
    this.id = summary.id;
    this.prompt = summary.prompt;
    this.folder = summary.folder;
    this.name = summary.name;
    this.startedAt = summary.startedAt;
    this.limitMs = summary.limitMs;
    this.heard = summary.state;
    this.transcript = new Transcript(summary.folder);
    this.linkState = signal<RunLinkState>(summary.state);
    this.ended = signal(summary.endedAt);
    this.whyText = signal(summary.why);
    this.verdict = signal(summary.result);
    this.state = this.linkState.asReadonly();
    this.endedAt = this.ended.asReadonly();
    this.why = this.whyText.asReadonly();
    this.result = this.verdict.asReadonly();
  }

  /** The last state the runner sent. */
  get serverState(): RunState {
    return this.heard;
  }

  /** What its ending note is made from, as it stands. */
  ending(): RunEnding {
    return {
      state: this.linkState(),
      folder: this.folder,
      startedAt: this.startedAt,
      endedAt: this.ended(),
      limitMs: this.limitMs,
      why: this.whyText(),
    };
  }

  /** Reads one event and shows it. */
  read(event: RunEvent): void {
    this.take(event);
    this.show();
  }

  /** Reads events kept from before, showing them once at the end. */
  replay(events: readonly RunEvent[]): void {
    for (const event of events) this.take(event);
    this.show();
  }

  setState(state: RunLinkState): void {
    this.linkState.set(state);
  }

  /** The runner's state is `state`, whatever the events said: the list is
   *  newer than a cache kept from before a reload. */
  hearState(state: RunState): void {
    this.heard = state;
  }

  setNote(note: RunNote | null): void {
    this.noted.set(note);
  }

  private take(event: RunEvent): void {
    if (event.kind === 'state' && isObject(event.data)) this.hearStateEvent(event.data);
    this.transcript.read(event);
  }

  private hearStateEvent(data: Json): void {
    const state = fieldOf(data, 'state', oneOf(RUN_STATES));
    if (state) this.heard = state;
    if (isText(data['why'])) this.whyText.set(data['why']);
    if (isNumber(data['endedAt'])) this.ended.set(data['endedAt']);
  }

  private show(): void {
    this.shownEntries.set(this.transcript.entries());
    this.learned.set(this.transcript.facts());
  }
}
