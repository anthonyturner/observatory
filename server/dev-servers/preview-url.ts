const ESCAPE = String.fromCharCode(0x1b);
/** Colour and cursor codes, which dev servers wrap around the very port they print. */
const ANSI_CODES = new RegExp(String.raw`${ESCAPE}\[[0-9;?]*[ -/]*[@-~]`, 'g');
const WEB_ADDRESS = /https?:\/\/[^\s"'<>)]+/gi;
/** Sentence punctuation after an address in a log line is not part of it. */
const TRAILING_PUNCTUATION = /[.,;:]+$/;
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

/** `line` as plain text, without terminal colour codes. */
export const plainText = (line: string): string => line.replaceAll(ANSI_CODES, '');

/** `address` when it really is a port on this machine: the parsed host decides, so
 *  `http://localhost:3000@evil.example/` (a user name, then another host) is not. */
function loopbackAddress(address: string): string | null {
  try {
    const url = new URL(address);
    return LOOPBACK_HOSTS.has(url.hostname) && url.port !== '' ? address : null;
  } catch {
    return null;
  }
}

/** Whether a line labels its address `Local:`, as Vite, Angular and Next do for the site itself. */
export const isLocalLine = (line: string): boolean => /\bLocal:/i.test(plainText(line));

/** The first address in a line of a server's output that is a port on this machine, or null. */
export function localUrlIn(line: string): string | null {
  for (const [found] of plainText(line).matchAll(WEB_ADDRESS)) {
    const address = loopbackAddress(found.replace(TRAILING_PUNCTUATION, ''));
    if (address) return address;
  }
  return null;
}
