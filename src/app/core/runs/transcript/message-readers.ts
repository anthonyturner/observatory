import { Json, isObject } from '../../json/json-fields';
import { firstLine } from '../run-words';
import { EventReader, TranscriptContext, plainRow, unknownRow } from './transcript-context';
import { textOf } from './tool-words';
import { DETAIL_LINES } from './transcript.types';

/** What a message carries, and whether it is inside an agent Claude started. */
interface Message {
  readonly parts: readonly unknown[];
  readonly isNested: boolean;
}

/** A message's parts; a message of plain text is one text part. */
function messageOf(data: Json): Message {
  const message = isObject(data['message']) ? data['message'] : {};
  const content = message['content'];
  const parts = typeof content === 'string' ? [{ type: 'text', text: content }] : content;
  return { parts: Array.isArray(parts) ? parts : [], isNested: !!data['parent_tool_use_id'] };
}

const partType = (part: Json): string => (typeof part['type'] === 'string' ? part['type'] : 'part');

function addWords(context: TranscriptContext, text: unknown, isNested: boolean): void {
  const words = String(text ?? '').trim();
  if (words) context.list.add({ kind: 'text', text: words, isNested });
}

/** Usually empty: Claude Code keeps the thinking itself to the model. */
function addThought(context: TranscriptContext, part: Json, isNested: boolean): void {
  const thinking = String(part['thinking'] ?? '');
  if (!thinking.trim()) return;
  const detail = [
    { kind: 'block' as const, title: 'Thinking', text: thinking, lines: Number.POSITIVE_INFINITY },
  ];
  context.list.add(plainRow('Thought', firstLine(thinking), detail, isNested));
}

/** Words the run sent Claude, such as a hook's: a row that opens on them. */
function addSent(context: TranscriptContext, text: unknown, isNested: boolean): void {
  const sent = String(text ?? '');
  if (!sent.trim()) return;
  const detail = [
    { kind: 'block' as const, title: 'Sent to Claude', text: sent, lines: DETAIL_LINES },
  ];
  context.list.add(plainRow('To Claude', firstLine(sent), detail, isNested));
}

function readAssistantPart(context: TranscriptContext, part: Json, isNested: boolean): void {
  const type = partType(part);
  if (type === 'text') addWords(context, part['text'], isNested);
  else if (type === 'tool_use') context.tools.called(part, isNested);
  else if (type === 'thinking' || type === 'redacted_thinking') addThought(context, part, isNested);
  else context.list.add(unknownRow(`assistant · ${type}`, part));
}

function readUserPart(context: TranscriptContext, part: Json, isNested: boolean): void {
  const type = partType(part);
  if (type === 'tool_result') context.tools.resulted(part, textOf(part['content']));
  else if (type === 'text') addSent(context, part['text'], isNested);
  else context.list.add(unknownRow(`user · ${type}`, part));
}

/** Claude's words, its tool calls and its thinking. */
export const readAssistant: EventReader = (context, data) => {
  context.think(false);
  const { parts, isNested } = messageOf(data);
  for (const part of parts) readAssistantPart(context, isObject(part) ? part : {}, isNested);
};

/** Tool results, and words sent to Claude. */
export const readUser: EventReader = (context, data) => {
  context.think(false);
  const { parts, isNested } = messageOf(data);
  for (const part of parts) readUserPart(context, isObject(part) ? part : {}, isNested);
};
