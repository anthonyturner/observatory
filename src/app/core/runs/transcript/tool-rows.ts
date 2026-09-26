import { Json, isObject } from '../../json/json-fields';
import { EntryList } from './entry-list';
import { HookRows } from './hook-rows';
import { toolArg, toolTitle, toolVerb } from './tool-words';
import { DETAIL_LINES, NewEntry, RowDetail, RowRefusal, RowStatus } from './transcript.types';

const TRIMMED_CALL = 'its call was trimmed from the output';

interface Tool {
  readonly key: number;
  readonly name: string;
  readonly input: Json;
  /** False when its call was dropped from the output and only its result came. */
  readonly isKnown: boolean;
  readonly isNested: boolean;
  status: RowStatus;
  result: string | null;
  isError: boolean;
  refusal: RowRefusal | null;
}

/** What a tool's row needs to be drawn. */
interface ToolCall {
  readonly id: unknown;
  readonly name: string;
  readonly input: Json;
  readonly isKnown: boolean;
  readonly isNested: boolean;
}

const inputText = (input: Json): string =>
  typeof input['command'] === 'string' ? input['command'] : JSON.stringify(input, null, 2);

function detailOf(tool: Tool): RowDetail[] {
  const call: RowDetail[] = tool.isKnown
    ? [{ kind: 'block', title: 'Called with', text: inputText(tool.input), lines: DETAIL_LINES }]
    : [];
  if (tool.refusal) return call;
  if (tool.result === null) return [...call, { kind: 'note', text: 'No result yet.' }];
  const title = tool.isError ? 'Result · failed' : 'Result';
  return [...call, { kind: 'block', title, text: tool.result, lines: DETAIL_LINES }];
}

function entryOf(tool: Tool, folder: string): NewEntry {
  return {
    kind: 'fold',
    name: toolTitle(tool.name),
    arg: tool.isKnown ? toolArg(tool.name, tool.input, folder) : TRIMMED_CALL,
    status: tool.status,
    isPlain: false,
    isNested: tool.isNested,
    refusal: tool.refusal,
    detail: detailOf(tool),
  };
}

function refusalOf(data: Json, name: string, hookEvent: string | null): RowRefusal {
  const verb = toolVerb(name);
  const words = data['message'] || data['decision_reason'];
  const claudeSaid = words ? `Claude Code: ${String(words)}` : null;
  if (hookEvent) {
    return {
      isExpected: true,
      tag: 'Expected · from a hook',
      why: `One of your ${hookEvent} hooks asked Claude to ${verb} this. A run from Home can’t, so it was skipped. This happens in every run and does not affect the task.`,
      claudeSaid,
    };
  }
  return {
    isExpected: false,
    tag: 'Not allowed',
    why: `Claude asked to ${verb} this. Your Claude Code settings don’t allow it, and a run from Home can’t ask you, so it was not done. Claude carries on without it.`,
    claudeSaid,
  };
}

/** Each tool Claude calls: one row, marked as its result comes back, or as
 *  the owner's settings refuse it. */
export class ToolRows {
  private readonly tools = new Map<unknown, Tool>();
  private refusedCount = 0;
  private lastRefusedName: string | null = null;

  private readonly list: EntryList;
  private readonly hooks: HookRows;
  private readonly folder: string;

  constructor(list: EntryList, hooks: HookRows, folder: string) {
    this.list = list;
    this.hooks = hooks;
    this.folder = folder;
  }

  get refused(): number {
    return this.refusedCount;
  }

  get lastRefused(): string | null {
    return this.lastRefusedName;
  }

  /** A `tool_use` block of Claude's. */
  called(block: Json, isNested: boolean): void {
    if (this.tools.has(block['id'])) return;
    this.add({
      id: block['id'],
      name: String(block['name'] ?? 'Tool'),
      input: isObject(block['input']) ? block['input'] : {},
      isKnown: true,
      isNested,
    });
  }

  /** A `tool_result` block, answering an earlier call. */
  resulted(block: Json, text: string): void {
    const tool = this.toolFor(block['tool_use_id'], 'Tool');
    tool.result = text;
    tool.isError = block['is_error'] === true;
    if (!tool.refusal) tool.status = tool.isError ? 'err' : 'ok';
    this.redraw(tool);
  }

  /** A `permission_denied` event. It names the tool and its call's id, but
   *  not what the call asked for. */
  denied(data: Json): void {
    const name = String(data['tool_name'] ?? 'Tool');
    const tool = this.toolFor(data['tool_use_id'] ?? `refused-${this.tools.size}`, name);
    if (tool.refusal) return;
    const hookEvent = this.hooks.thatNamed(tool.input);
    tool.refusal = refusalOf(data, tool.name, hookEvent);
    tool.status = hookEvent ? 'skipped' : 'refused';
    this.redraw(tool);
    if (hookEvent) return;
    this.refusedCount++;
    this.lastRefusedName = toolTitle(tool.name);
  }

  private toolFor(id: unknown, name: string): Tool {
    return this.tools.get(id) ?? this.add({ id, name, input: {}, isKnown: false, isNested: false });
  }

  private add(call: ToolCall): Tool {
    const draft = { ...call, status: 'run' as const, result: null, isError: false, refusal: null };
    const tool: Tool = {
      ...draft,
      key: this.list.add(entryOf({ ...draft, key: -1 }, this.folder)),
    };
    this.tools.set(call.id, tool);
    return tool;
  }

  private redraw(tool: Tool): void {
    this.list.replace(tool.key, entryOf(tool, this.folder));
  }
}
