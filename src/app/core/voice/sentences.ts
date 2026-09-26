/** Kokoro reads at most about 500 sounds at a time and drops the rest, so a
 *  sentence longer than this is cut at a comma or a space. */
export const SENTENCE_MAX = 200;

/** A cut at a comma is kept only this far in; nearer the start, a space. */
const EARLIEST_COMMA = SENTENCE_MAX / 3;

/** `text` as sentences short enough to speak, with code marks dropped. */
export function sentences(text: string): string[] {
  return text
    .replace(/`/g, '')
    .split(/(?<=[.!?…])\s+|\n+/)
    .flatMap((piece) => shortEnough(piece.trim()));
}

function shortEnough(sentence: string): string[] {
  const parts: string[] = [];
  let rest = sentence;
  while (rest.length > SENTENCE_MAX) {
    const at = cutPoint(rest);
    parts.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (/\w/.test(rest)) parts.push(rest);
  return parts;
}

function cutPoint(sentence: string): number {
  const comma = Math.max(
    sentence.lastIndexOf(', ', SENTENCE_MAX),
    sentence.lastIndexOf('; ', SENTENCE_MAX),
  );
  if (comma > EARLIEST_COMMA) return comma + 1;
  const space = sentence.lastIndexOf(' ', SENTENCE_MAX);
  return space > 0 ? space : SENTENCE_MAX;
}
