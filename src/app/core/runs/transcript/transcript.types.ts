/** A tool row's mark: running, worked, failed, refused, skipped as expected,
 *  or a plain row that is not a tool. */
export type RowStatus = 'run' | 'ok' | 'err' | 'refused' | 'skipped' | 'note';

/** Lines of a tool's input or result shown before Show all. */
export const DETAIL_LINES = 40;

/** A titled block of text in an opened row, cut to `lines` until Show all. */
export interface DetailBlock {
  readonly kind: 'block';
  readonly title: string;
  readonly text: string;
  readonly lines: number;
}

export interface DetailNote {
  readonly kind: 'note';
  readonly text: string;
}

/** One hook in the Hooks row: its name, then how it went. */
export interface HookLine {
  readonly name: string;
  readonly said: string;
}

export interface DetailHooks {
  readonly kind: 'hooks';
  readonly title: string;
  readonly hooks: readonly HookLine[];
}

export type RowDetail = DetailBlock | DetailNote | DetailHooks;

/** Why a tool was not used: the owner's settings refused it, or one of their
 *  own hooks asked for it and a run from Home cannot do that. */
export interface RowRefusal {
  readonly isExpected: boolean;
  readonly tag: string;
  readonly why: string;
  /** Claude Code's own words for it, when it gave some. */
  readonly claudeSaid: string | null;
}

/** A one-line row that opens for more: a tool, the hooks, or an event. */
export interface FoldEntry {
  readonly kind: 'fold';
  readonly key: number;
  readonly name: string;
  readonly arg: string;
  readonly status: RowStatus;
  /** Not a tool: its name steps back. */
  readonly isPlain: boolean;
  /** Inside an agent Claude started. */
  readonly isNested: boolean;
  readonly refusal: RowRefusal | null;
  readonly detail: readonly RowDetail[];
}

/** A quiet line of what Claude Code does around the task. */
export interface QuietEntry {
  readonly kind: 'quiet';
  readonly key: number;
  readonly text: string;
  readonly isWarning: boolean;
}

/** Claude's own words. */
export interface TextEntry {
  readonly kind: 'text';
  readonly key: number;
  readonly text: string;
  readonly isNested: boolean;
}

/** The run's verdict: what it came to, how long, what it cost. */
export interface ResultEntry {
  readonly kind: 'result';
  readonly key: number;
  readonly isBad: boolean;
  readonly heading: string;
  readonly lines: readonly string[];
}

export type TranscriptEntry = FoldEntry | QuietEntry | TextEntry | ResultEntry;

/** An entry before the transcript numbers it. */
export type NewEntry =
  | Omit<FoldEntry, 'key'>
  | Omit<QuietEntry, 'key'>
  | Omit<TextEntry, 'key'>
  | Omit<ResultEntry, 'key'>;

/** What the transcript has learned of the run so far. */
export interface TranscriptFacts {
  readonly isThinking: boolean;
  /** Tools the owner's settings refused, not counting a hook's expected ones. */
  readonly refused: number;
  /** The last refused tool's name, for the milestone that says so. */
  readonly lastRefused: string | null;
  readonly costUsd: number | null;
  /** Claude Code's result said it stopped with an error. */
  readonly hasFailed: boolean;
}

export const NO_FACTS: TranscriptFacts = {
  isThinking: false,
  refused: 0,
  lastRefused: null,
  costUsd: null,
  hasFailed: false,
};
