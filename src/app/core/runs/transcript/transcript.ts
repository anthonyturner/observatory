import { Json, isObject } from '../../json/json-fields';
import { RunEvent } from '../runs.types';
import { readRateLimit, readResult, readSessionStart, readState } from './closing-readers';
import { readAssistant, readUser } from './message-readers';
import { EventReader, TranscriptContext, quietLine, unknownRow } from './transcript-context';
import { TranscriptState } from './transcript-state';
import { TranscriptEntry, TranscriptFacts } from './transcript.types';

/* Claude Code's stream-json, read as a transcript instead of a wall of JSON.
   The shapes are Claude Code 2.1's, seen live: the owner's hooks as system
   hook_started, hook_progress and hook_response; thinking_tokens while it
   thinks; rate_limit_event; assistant and user messages carrying tool_use and
   tool_result blocks; a refused tool as system/permission_denied, which names
   the tool and its tool_use_id but not what it was called with; and result
   at the end. */

const readHook: EventReader = (context, data) => context.hooks.read(data);

/** Each of Claude Code's events by its type, a system event by its subtype
 *  too. A new kind is one more entry. */
const CLAUDE_READERS: Readonly<Record<string, EventReader>> = {
  'system/init': readSessionStart,
  'system/hook_started': readHook,
  'system/hook_progress': readHook,
  'system/hook_response': readHook,
  'system/thinking_tokens': (context) => context.think(true),
  'system/permission_denied': (context, data) => context.tools.denied(data),
  rate_limit_event: readRateLimit,
  assistant: readAssistant,
  user: readUser,
  result: readResult,
};

type KindReader = (context: TranscriptContext, data: unknown) => void;

const fieldsOf = (data: unknown): Json => (isObject(data) ? data : {});

function readClaude(context: TranscriptContext, data: unknown): void {
  if (!isObject(data)) return void context.list.add(quietLine(String(data)));
  const key =
    data['type'] === 'system' ? `system/${String(data['subtype'])}` : String(data['type']);
  const reader = CLAUDE_READERS[key];
  if (reader) reader(context, data);
  else context.list.add(unknownRow(key, data));
}

/** The runner's own event kinds, round Claude Code's. */
const KIND_READERS: Readonly<Record<string, KindReader>> = {
  claude: readClaude,
  state: (context, data) => readState(context, fieldsOf(data)),
  text: (context, data) => context.list.add(quietLine(String(data))),
  stderr: (context, data) => context.list.add(quietLine(`stderr · ${String(data)}`)),
  trimmed: (context, data) => {
    const dropped = String(fieldsOf(data)['dropped']);
    context.list.add(quietLine(`Earlier output trimmed to save memory (${dropped} events).`));
  },
  cut: (context, data) => {
    const { size, head } = fieldsOf(data);
    const text = `One event was too long to keep (${String(size)} characters). It began: ${String(head)}…`;
    context.list.add(quietLine(text));
  },
};

/** One run's output read as a transcript: rows for tools, Claude's words,
 *  quiet lines for what goes on around them, and the verdict. */
export class Transcript {
  private readonly state: TranscriptState;

  constructor(folder: string) {
    this.state = new TranscriptState(folder);
  }

  read(event: RunEvent): void {
    const reader = KIND_READERS[event.kind];
    if (reader) reader(this.state, event.data);
    else this.state.list.add(quietLine(`event: ${event.kind}`));
  }

  entries(): readonly TranscriptEntry[] {
    return this.state.list.snapshot();
  }

  facts(): TranscriptFacts {
    return this.state.facts;
  }
}
