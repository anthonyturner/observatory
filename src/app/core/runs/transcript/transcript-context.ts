import { Json } from '../../json/json-fields';
import { EntryList } from './entry-list';
import { HookRows } from './hook-rows';
import { ToolRows } from './tool-rows';
import { DETAIL_LINES, NewEntry, RowDetail } from './transcript.types';

/** What a reader of one kind of event may use and change. */
export interface TranscriptContext {
  readonly list: EntryList;
  readonly tools: ToolRows;
  readonly hooks: HookRows;
  /** The run's folder, for shortening paths inside it. */
  readonly folder: string;
  think(isThinking: boolean): void;
  /** Claude Code's closing verdict. */
  conclude(hasFailed: boolean, costUsd: number | null): void;
  hasWarned(key: string): boolean;
  markWarned(key: string): void;
}

/** Reads one of Claude Code's stream-json events into the transcript. */
export type EventReader = (context: TranscriptContext, data: Json) => void;

export const quietLine = (text: string): NewEntry => ({ kind: 'quiet', text, isWarning: false });

export const warningLine = (text: string): NewEntry => ({ kind: 'quiet', text, isWarning: true });

/** A plain row that opens on `detail`: not a tool, so it has no mark. */
export function plainRow(
  name: string,
  arg: string,
  detail: readonly RowDetail[],
  isNested = false,
): NewEntry {
  return {
    kind: 'fold',
    name,
    arg,
    status: 'note',
    isPlain: true,
    isNested,
    refusal: null,
    detail,
  };
}

/** An event no reader knows. It still shows, as a row that opens on its
 *  JSON: unknown is not healthy, so it is never dropped. */
export const unknownRow = (what: string, raw: unknown): NewEntry =>
  plainRow('Event', what, [
    {
      kind: 'block',
      title: 'As Claude Code sent it',
      text: JSON.stringify(raw, null, 2),
      lines: DETAIL_LINES,
    },
  ]);
