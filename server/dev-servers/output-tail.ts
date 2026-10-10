import { plainText } from './preview-url.ts';

/** More than a line or two of a server's last words is never read. */
const KEPT_CHARS = 4 * 1024;
/** A longer last line is cut, to fit a status message. */
const LINE_CHARS = 200;
const LINE_BREAKS = /[\r\n]+/;

/**
 * The end of a server's output, kept to say where it stopped. It sees raw
 * chunks, not lines, because a question such as "Use a different port? (Y/n)"
 * is never followed by a newline: the server is waiting for the answer.
 */
export class OutputTail {
  private text = '';

  add(chunk: string | Buffer): void {
    this.text = (this.text + chunk.toString()).slice(-KEPT_CHARS);
  }

  /** The last line with something on it, without terminal colour codes, or '' when nothing was printed. */
  lastLine(): string {
    const lines = plainText(this.text)
      .split(LINE_BREAKS)
      .map((line) => line.trim())
      .filter(Boolean);
    return (lines.at(-1) ?? '').slice(0, LINE_CHARS);
  }
}
