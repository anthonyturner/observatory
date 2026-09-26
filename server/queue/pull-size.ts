/**
 * pr-starmap's limits on what one pull request's screen carries, so a huge
 * description or diff arrives cut short and says so, rather than not at all.
 * pr-starmap kept each pull request in one stored document of at most 256 KiB;
 * the same budget keeps this answer quick to send and to render.
 */

/** JSON escaping inflates a diff, so the budget is on the serialized answer, with headroom. */
export const DETAIL_LIMIT_BYTES = 240 * 1024;
export const BODY_LIMIT_CHARS = 60 * 1024;
/** Cut this much further below the limit on the first try, for the fields around the diff. */
const HEADROOM_CHARS = 4096;
/** Each later try keeps this share of the one before. */
const SHRINK = 0.8;

/** A description cut to BODY_LIMIT_CHARS, saying whether it was. */
export function clipBody(body: string | null): { body: string; bodyTruncated: boolean } {
  const text = body ?? '';
  const bodyTruncated = text.length > BODY_LIMIT_CHARS;
  return { body: bodyTruncated ? text.slice(0, BODY_LIMIT_CHARS) : text, bodyTruncated };
}

/** The cap is in bytes, not characters: one character can take four. */
export const sizeOf = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), 'utf8');

interface WithDiff {
  readonly diff: string;
  readonly diffTruncated: boolean;
}

/** Trims the diff, never anything else, until the whole fits in `limit` bytes. */
export function fitDiff<T extends WithDiff>(detail: T, limit = DETAIL_LIMIT_BYTES): T {
  let bytes = sizeOf(detail);
  if (bytes <= limit) return detail;
  const full = detail.diff;
  let keep = Math.max(0, full.length - (bytes - limit) - HEADROOM_CHARS);
  while (keep > 0) {
    // At a line's end, so the screen never shows half a line of a hunk.
    const cut = full.lastIndexOf('\n', keep);
    const next = { ...detail, diff: full.slice(0, cut > 0 ? cut : keep), diffTruncated: true };
    bytes = sizeOf(next);
    if (bytes <= limit) return next;
    keep = Math.floor(keep * SHRINK);
  }
  return { ...detail, diff: '', diffTruncated: true };
}
