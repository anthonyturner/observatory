import { AnswerBook, type Answers } from './transcript-answers.ts';
import { lastLines, linesFrom } from './transcript-window.ts';

/** How far back a transcript seen for the first time is read for answers. A
 *  spawner's answer can lie megabytes before its end, past the tail the rest
 *  of the list reads; one further back than this is missed until the server
 *  has followed the file from here, and its subagent reads quiet meanwhile. */
const FIRST_READ_BYTES = 8 * 1024 * 1024;

interface Cursor {
  readonly next: number;
  readonly book: AnswerBook;
}

/** Every answer each live transcript records, kept between reads so each
 *  read takes only the bytes written since the last. */
export class AnswerIndex {
  private readonly cursors = new Map<string, Cursor>();
  private readonly firstReadBytes: number;

  constructor(firstReadBytes = FIRST_READ_BYTES) {
    this.firstReadBytes = firstReadBytes;
  }

  /** The answers `file` records so far. A file that cannot be read has none. */
  async answersIn(file: string): Promise<Answers> {
    const had = this.cursors.get(file);
    if (had) {
      const window = await linesFrom(file, had.next);
      if (window) {
        had.book.add(window.lines);
        this.cursors.set(file, { next: window.next, book: had.book });
        return had.book;
      }
    }
    // Never seen, or gone or written afresh since: read it as new.
    return (await this.firstRead(file)).book;
  }

  /** Forgets every transcript but `files`, so the index holds the live ones only. */
  keepOnly(files: ReadonlySet<string>): void {
    for (const file of this.cursors.keys()) if (!files.has(file)) this.cursors.delete(file);
  }

  private async firstRead(file: string): Promise<Cursor> {
    const book = new AnswerBook();
    const window = await lastLines(file, this.firstReadBytes);
    book.add(window?.lines ?? []);
    const cursor = { next: window?.next ?? 0, book };
    if (window) this.cursors.set(file, cursor);
    else this.cursors.delete(file);
    return cursor;
  }
}
