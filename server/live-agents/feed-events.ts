/* What of a transcript line may leave this machine's server. Every block is
   rebuilt from the fields named here, never copied, so whatever else a line
   carries (thinking, `toolUseResult`, attachments, fields a later Claude Code
   adds) stays behind. */

import { keyScrubber } from '../util/key-scrub.ts';
import type { FeedBlock, FeedEvent, FeedValue } from './feed-types.ts';
import { type Block, type TranscriptLine, blocksOf, isBlock, text } from './transcript-lines.ts';

export const TOOL_INPUT_CHARS = 300;
export const TOOL_RESULT_CHARS = 2_000;
/** Claude's words and a prompt's: a compacted session's summary runs to pages. */
export const TEXT_CHARS = 8_000;
/** A tool's input is a few fields; past this many items or levels it is data, not a call. */
const INPUT_ITEMS = 50;
const INPUT_DEPTH = 4;
const CUT = '…';
const IMAGE = '[image not shown]';

const scrub = keyScrubber(null);

/** `value` at most `chars` long, any bearer token or API key in it blanked. */
export function clipped(value: string, chars: number): string {
  const said = scrub(value);
  return said.length > chars ? `${said.slice(0, chars - CUT.length)}${CUT}` : said;
}

function inputValue(value: unknown, depth: number): FeedValue {
  if (typeof value === 'string') return clipped(value, TOOL_INPUT_CHARS);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (depth >= INPUT_DEPTH) return CUT;
  if (Array.isArray(value)) {
    return value.slice(0, INPUT_ITEMS).map((item: unknown) => inputValue(item, depth + 1));
  }
  return isBlock(value) ? inputFields(value, depth + 1) : CUT;
}

function inputFields(fields: Block, depth = 0): { readonly [key: string]: FeedValue } {
  return Object.fromEntries(
    Object.entries(fields)
      .slice(0, INPUT_ITEMS)
      .map(([key, value]) => [key, inputValue(value, depth)]),
  );
}

/** A tool result's text: its own string, or its text parts with images named, not sent. */
function resultText(content: unknown): string {
  if (typeof content === 'string') return content;
  return blocksOf(content)
    .map((part) => (part['type'] === 'image' ? IMAGE : (text(part['text']) ?? '')))
    .filter(Boolean)
    .join('\n');
}

const textBlock = (value: unknown): FeedBlock | null => {
  const said = text(value);
  return said === null ? null : { type: 'text', text: clipped(said, TEXT_CHARS) };
};

function replyBlock(block: Block): FeedBlock | null {
  if (block['type'] === 'text') return textBlock(block['text']);
  if (block['type'] !== 'tool_use') return null;
  return {
    type: 'tool_use',
    id: text(block['id']) ?? '',
    name: text(block['name']) ?? 'Tool',
    input: isBlock(block['input']) ? inputFields(block['input']) : {},
  };
}

function promptBlock(block: Block): FeedBlock | null {
  if (block['type'] === 'text') return textBlock(block['text']);
  if (block['type'] === 'image') return { type: 'text', text: IMAGE };
  if (block['type'] !== 'tool_result') return null;
  return {
    type: 'tool_result',
    tool_use_id: text(block['tool_use_id']) ?? '',
    is_error: block['is_error'] === true,
    content: clipped(resultText(block['content']), TOOL_RESULT_CHARS),
  };
}

function eventOf(
  type: FeedEvent['type'],
  content: unknown,
  blockOf: (block: Block) => FeedBlock | null,
): FeedEvent | null {
  if (typeof content === 'string') {
    return content.trim() ? { type, message: { content: clipped(content, TEXT_CHARS) } } : null;
  }
  const blocks = blocksOf(content).flatMap((block) => blockOf(block) ?? []);
  return blocks.length > 0 ? { type, message: { content: blocks } } : null;
}

/** The line as the feed sends it, or null for one it does not: anything but a
 *  reply or a prompt, a line Claude Code adds for itself (`isMeta`), and a
 *  reply that was only thinking. */
export function feedEventOf(line: TranscriptLine): FeedEvent | null {
  const content = line.message?.content;
  if (line.type === 'assistant') return eventOf('assistant', content, replyBlock);
  if (line.type === 'user' && line.isMeta !== true) return eventOf('user', content, promptBlock);
  return null;
}
