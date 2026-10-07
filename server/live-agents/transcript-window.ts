import { type FileHandle, open } from 'node:fs/promises';

/** Whole lines read from a transcript, and the byte offset just past the last. */
export interface LineWindow {
  readonly lines: readonly string[];
  readonly next: number;
}

/** A transcript's end: the most a reader keeps of a file that runs to megabytes. */
const TAIL_BYTES = 256 * 1024;

const NEWLINE = 0x0a;

/** The whole lines in `buffer`, read from byte `start`. A line still being
 *  written has no newline yet, so it waits for the next read. */
function wholeLines(buffer: Buffer, start: number, skipFirst: boolean): LineWindow {
  const end = buffer.lastIndexOf(NEWLINE);
  const from = skipFirst ? buffer.indexOf(NEWLINE) + 1 : 0;
  if (end < 0 || from > end) return { lines: [], next: start + Math.max(from, 0) };
  return {
    lines: buffer.toString('utf8', from, end).split('\n').filter(Boolean),
    next: start + end + 1,
  };
}

async function readWindow(
  file: string,
  startOf: (size: number) => number,
  skipFirst: (start: number) => boolean,
): Promise<LineWindow | null> {
  let handle;
  try {
    handle = await open(file, 'r');
    const { size } = await handle.stat();
    const start = Math.min(size, Math.max(0, startOf(size)));
    const buffer = Buffer.alloc(size - start);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
    return wholeLines(buffer.subarray(0, bytesRead), start, skipFirst(start));
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

/** The whole lines in `file`'s last `bytes`. The window starts a byte early, so
 *  a line that begins exactly at its edge is kept, and one cut by it is not. */
export async function lastLines(file: string, bytes = TAIL_BYTES): Promise<LineWindow | null> {
  return readWindow(
    file,
    (size) => size - bytes - 1,
    (start) => start > 0,
  );
}

/** The whole lines of `file` from byte `from`, which starts a line; null when
 *  the file is gone or now shorter than that, as one written afresh would be. */
export async function linesFrom(file: string, from: number): Promise<LineWindow | null> {
  const window = await readWindow(
    file,
    () => from,
    () => false,
  );
  return window && window.next >= from ? window : null;
}

/** One whole line, and the byte offset just past it. */
export interface LineAt {
  readonly text: string;
  readonly end: number;
}

/** Whole lines read from a cursor, each with where it ends, and the offset past the last. */
export interface LineSpans {
  readonly lines: readonly LineAt[];
  readonly next: number;
}

/** How much of an over-long line is read at a time while looking for its end. */
const SCAN_BYTES = 64 * 1024;

function spansIn(buffer: Buffer, start: number): LineSpans {
  const lines: LineAt[] = [];
  let from = 0;
  for (let end = buffer.indexOf(NEWLINE); end >= 0; end = buffer.indexOf(NEWLINE, from)) {
    if (end > from) lines.push({ text: buffer.toString('utf8', from, end), end: start + end + 1 });
    from = end + 1;
  }
  return { lines, next: start + from };
}

/** The offset just past the newline at or after `from`, or null when the line is still being written. */
async function endOfLine(handle: FileHandle, from: number): Promise<number | null> {
  const chunk = Buffer.alloc(SCAN_BYTES);
  for (let at = from; ; at += SCAN_BYTES) {
    const { bytesRead } = await handle.read(chunk, 0, SCAN_BYTES, at);
    if (bytesRead === 0) return null;
    const newline = chunk.subarray(0, bytesRead).indexOf(NEWLINE);
    if (newline >= 0) return at + newline + 1;
  }
}

/**
 * The whole lines of `file` from byte `from`, which starts a line, reading no
 * more than `maxBytes`. A line longer than that could never fit a read, so it
 * is stepped over: `next` moves past it and nothing is returned for it. Null
 * when the file is gone or now shorter than `from`.
 */
export async function lineSpansFrom(
  file: string,
  from: number,
  maxBytes: number,
): Promise<LineSpans | null> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(file, 'r');
    const { size } = await handle.stat();
    if (size < from) return null;
    const buffer = Buffer.alloc(Math.min(maxBytes, size - from));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, from);
    const spans = spansIn(buffer.subarray(0, bytesRead), from);
    if (spans.next > from || bytesRead < maxBytes) return spans;
    return { lines: [], next: (await endOfLine(handle, from + bytesRead)) ?? from };
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

/** The whole lines in `file`'s last `bytes`, or none when it cannot be read. */
export async function tailLines(file: string, bytes = TAIL_BYTES): Promise<readonly string[]> {
  return (await lastLines(file, bytes))?.lines ?? [];
}
