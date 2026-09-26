import type { Readable } from 'node:stream';

/** What a line reader hands on. */
export interface LineListener {
  onLine(line: string): void;
  /** A line longer than the limit: its first characters, and how long it was. */
  onOverlong(head: string, size: number): void;
}

/** Enough of an overlong line to tell what it was. */
const HEAD_CHARS = 400;
const TRAILING_CR = /\r$/;

/** The line being gathered: its text, or once over the limit only its head and size. */
interface Pending {
  text: string;
  overlong: { readonly head: string; size: number } | null;
}

function gather(pending: Pending, part: string, maxChars: number): void {
  if (pending.overlong) {
    pending.overlong.size += part.length;
    return;
  }
  pending.text += part;
  if (pending.text.length > maxChars) {
    pending.overlong = { head: pending.text.slice(0, HEAD_CHARS), size: pending.text.length };
    pending.text = '';
  }
}

function flush(pending: Pending, listener: LineListener): void {
  if (pending.overlong) listener.onOverlong(pending.overlong.head, pending.overlong.size);
  else listener.onLine(pending.text.replace(TRAILING_CR, ''));
  pending.text = '';
  pending.overlong = null;
}

/** Hands `listener` each line of `stream`, never holding more than `maxChars` of one. */
export function readLines(stream: Readable, maxChars: number, listener: LineListener): void {
  const pending: Pending = { text: '', overlong: null };
  stream.setEncoding('utf8');
  stream.on('data', (chunk: string) => {
    const parts = chunk.split('\n');
    parts.forEach((part, index) => {
      gather(pending, part, maxChars);
      if (index < parts.length - 1) flush(pending, listener);
    });
  });
  stream.on('end', () => {
    if (pending.overlong || pending.text) flush(pending, listener);
  });
  // A pipe torn down by a kill errors; the run's own exit already says how it ended.
  stream.on('error', () => undefined);
}
