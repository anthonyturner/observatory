import { open } from 'node:fs/promises';

/** Whole lines read from a transcript, and the byte offset just past the last. */
export interface LineWindow {
  readonly lines: readonly string[];
  readonly next: number;
}

/** A transcript's end: the most a reader keeps of a file that runs to megabytes. */
export const TAIL_BYTES = 256 * 1024;

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

/** The whole lines in `file`'s last `bytes`, or none when it cannot be read. */
export async function tailLines(file: string, bytes = TAIL_BYTES): Promise<readonly string[]> {
  return (await lastLines(file, bytes))?.lines ?? [];
}
