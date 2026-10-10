const ESCAPE = String.fromCharCode(0x1b);
/** Colour and cursor codes, which dev servers wrap around the very port they print. */
const ANSI_CODES = new RegExp(`${ESCAPE}\[[0-9;?]*[ -/]*[@-~]`, 'g');
const LOCAL_URL = /https?:\/\/(?:localhost|127\.0\.0\.1):\d+[^\s"'<>)\]]*/i;

/** `line` as plain text, without terminal colour codes. */
export const plainText = (line: string): string => line.replaceAll(ANSI_CODES, '');

/** The first localhost or 127.0.0.1 address in a line of a server's output, or null. */
export function localUrlIn(line: string): string | null {
  return LOCAL_URL.exec(plainText(line))?.[0] ?? null;
}
