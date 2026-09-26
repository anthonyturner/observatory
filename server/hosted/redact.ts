/**
 * The second pass over log text before a visitor sees it, as pr-starmap's
 * `site/redact.mjs` does it. Logs are already reduced before they are stored,
 * which strips most of what varies (numbers, payloads, URL paths), but that
 * is shaped for grouping faults, not for secrecy: a token of letters alone, an
 * email, a home folder or a credential in a URL's host would survive it. So
 * anything shaped like a secret or a person is blanked. Blanking a harmless
 * word costs a preview nothing; missing a secret costs more, so the patterns
 * lean wide.
 */

const HIDDEN = '[hidden]';

/** `user:password@` in a URL: the scheme is kept, so the fault still reads. */
const URL_CREDENTIALS = /\b([a-z][\w+.-]*:\/\/)[^\s/@'"]+@/gi;
/** `key=value` and `key: value` whose key says secret: the key is kept. */
const SECRET_PAIR =
  /\b([\w-]*(token|secret|password|passwd|pwd|api[_-]?key|apikey|auth|session|cookie|credential|signature|sig)[\w-]*)(\s*[=:]\s*['"]?|"\s*:\s*")[^\s,;&'"}]+/gi;

/**
 * Blanked whole, in order: the specific shapes first, so a JWT is not
 * half-caught as base64. The reduction upstream turns every run of digits into
 * `#`, so `#` stands for a digit throughout: without it a secret with digits
 * in it would arrive in short pieces no pattern matches.
 */
const WHOLE_PATTERNS: readonly RegExp[] = [
  // A JWT.
  /\beyJ[\w#-]{4,}\.[\w#-]{4,}(\.[\w#-]+)?/g,
  // An email address.
  /(?<![\w.#+-])[\w.#+-]+@[\w#-]+(\.[\w#-]+)+/g,
  // Authorization values.
  /\b(bearer|basic|token)\s+[\w.~#+/=-]{6,}/gi,
];

/** Blanked whole, after the secret pairs: people and machines, then generated strings. */
const LATE_PATTERNS: readonly RegExp[] = [
  // Home folders name the person: C:\Users\name, /Users/name, /home/name.
  /\b[a-z]:\\(users|documents and settings)\\[^\\\s'"]+/gi,
  /\/(users|home)\/[^/\s'"]+/gi,
  // IPv4 and IPv6 addresses.
  /\b\d{1,3}(\.\d{1,3}){3}\b/g,
  /\b([0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b/gi,
  // Long runs that look generated rather than written: hex, or base64-ish
  // with both letters and digits.
  /(?<![\w#])[0-9a-f#]{20,}(?![\w#])/gi,
  /(?<![\w#+/=-])(?=[\w#+/=-]*[\d#])(?=[\w#+/=-]*[a-z])[\w#+/=-]{24,}/gi,
  // A token may also arrive as letters alone; nothing a person writes runs to
  // 32 characters without a break.
  /[\w#+/=-]{32,}/g,
];

const blankAll = (text: string, patterns: readonly RegExp[]): string =>
  patterns.reduce((out, pattern) => out.replace(pattern, HIDDEN), text);

/** `text` with anything shaped like a secret or a person replaced by `[hidden]`. */
export function redactText(text: string): string {
  const withoutCredentials = text.replace(URL_CREDENTIALS, `$1${HIDDEN}@`);
  const early = blankAll(withoutCredentials, WHOLE_PATTERNS);
  const withoutPairs = early.replace(SECRET_PAIR, `$1$3${HIDDEN}`);
  return blankAll(withoutPairs, LATE_PATTERNS);
}

/** Every string in `value`, however deep, through `redactText`; the shape is kept. */
export function redactStrings(value: unknown): unknown {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactStrings);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [key, redactStrings(inner)]),
  );
}
