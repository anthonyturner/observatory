/** A piece of source split in two of the same length, so an offset in one is the same place in the other. */
export interface MaskedSource {
  /** The code alone: every comment, and every string's contents, blanked to spaces. A
   *  string keeps its quotes, so `''` still reads as a value. */
  readonly code: string;
  /** The comments alone: everything else blanked to spaces. */
  readonly comments: string;
}

type Mode = 'code' | 'line-comment' | 'block-comment' | "'" | '"' | '`';

const BLANK = ' ';
const NEWLINE = '\n';

const isComment = (mode: Mode): boolean => mode === 'line-comment' || mode === 'block-comment';

/** What the characters at `i` open, if anything, from plain code. */
function opening(source: string, i: number): { mode: Mode; width: number } | null {
  const pair = source.slice(i, i + 2);
  if (pair === '//') return { mode: 'line-comment', width: 2 };
  if (pair === '/*') return { mode: 'block-comment', width: 2 };
  const quote = source[i];
  if (quote === "'" || quote === '"' || quote === '`') return { mode: quote, width: 1 };
  return null;
}

/** How many characters close `mode` at `i`, or 0 when it goes on. */
function closing(source: string, i: number, mode: Mode): number {
  const char = source[i];
  if (mode === 'line-comment') return char === NEWLINE ? 1 : 0;
  if (mode === 'block-comment') return source.slice(i, i + 2) === '*/' ? 2 : 0;
  // A plain string cannot cross a line; a broken one ends there rather than masking the rest.
  if (mode !== '`' && char === NEWLINE) return 1;
  return char === mode ? 1 : 0;
}

/**
 * Splits TypeScript or JavaScript into its code and its comments, so a search
 * for braces or keywords is not fooled by a string, and a search for a TODO
 * finds only comments. A lexer would be exact; this ignores regular
 * expression literals and reads a template literal's `${…}` as string, which
 * is close enough for a heuristic and never throws.
 */
export function maskSource(source: string): MaskedSource {
  const code: string[] = [];
  const comments: string[] = [];
  /** Puts `char` in the code, the comments, or neither; a newline goes in both. */
  const put = (char: string, where: 'code' | 'comment' | 'neither'): void => {
    const isNewline = char === NEWLINE;
    code.push(isNewline || where === 'code' ? char : BLANK);
    comments.push(isNewline || where === 'comment' ? char : BLANK);
  };
  /** A quote mark stays in the code; a comment's own marks are comment. */
  const edge = (mode: Mode): 'code' | 'comment' => (isComment(mode) ? 'comment' : 'code');
  let mode: Mode = 'code';
  let i = 0;
  while (i < source.length) {
    if (mode === 'code') {
      const opened = opening(source, i);
      if (!opened) {
        put(source[i++], 'code');
        continue;
      }
      mode = opened.mode;
      for (let n = 0; n < opened.width; n++) put(source[i++], edge(mode));
      continue;
    }
    const inside = isComment(mode) ? 'comment' : 'neither';
    if (source[i] === '\\' && !isComment(mode)) {
      put(source[i++], inside);
      if (i < source.length) put(source[i++], inside);
      continue;
    }
    const width = closing(source, i, mode);
    if (width === 0) {
      put(source[i++], inside);
      continue;
    }
    for (let n = 0; n < width; n++) put(source[i++], edge(mode));
    mode = 'code';
  }
  return { code: code.join(''), comments: comments.join('') };
}
