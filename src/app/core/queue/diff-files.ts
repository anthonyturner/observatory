import { DiffSpan, wordChangesOf } from './diff-words';

/** One file of a unified diff, its lines kept raw until it is opened. */
export interface DiffFile {
  /** Where the file was before the change: the same as `newPath` unless it was renamed. */
  readonly path: string;
  /** Where the file is after it, or null when the header does not give it in plain text,
   *  as git quotes a path with unusual characters. */
  readonly newPath: string | null;
  /** The change removes the file, so there is nothing of it at the head. */
  readonly isDeleted: boolean;
  readonly additions: number;
  readonly deletions: number;
  /** Git named the file binary and sent none of it. */
  readonly isBinary: boolean;
  readonly lines: readonly string[];
}

/** `h` a hunk header, `a` an added line, `d` a removed one, `''` context. */
export type DiffLineKind = 'h' | 'a' | 'd' | '';

/** A line's `+`, `-` or space is kept apart from its code, so only the sign is coloured. */
export interface DiffLine {
  readonly kind: DiffLineKind;
  readonly sign: string;
  readonly text: string;
  /** The line's number before the change; none on an added line or a header. */
  readonly oldNumber: number | null;
  /** The line's number after the change; none on a removed line or a header. */
  readonly newNumber: number | null;
  /** The words that changed, when this line is half of a removed/added pair that has some. */
  readonly parts: readonly DiffSpan[] | null;
}

/** A path's folder (trailing slash kept) apart from the file's own name. */
export interface PathParts {
  readonly folder: string;
  readonly name: string;
}

const FILE_START = /^(?=diff --git )/m;
const FILE_HEADER = 'diff --git';
const PATH = /^diff --git a\/(.+?) b\//;
/** The header of a file that kept its path: both sides name the same one. */
const SAME_PATH = /^diff --git a\/(.+) b\/\1$/;
/** A path git quotes starts with a quote, and is not given in plain text. */
const RENAME_TO = /^rename to ([^"].*)$/;
const DELETED_FILE = /^deleted file mode /;
/** `@@ -12,7 +12,8 @@`'s new side: where it starts and how many lines it holds. */
const NEW_SIDE = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;
const UNNAMED = 'file';
const HUNK = '@@';
/** `@@ -12,7 +12,8 @@`: where the hunk starts in the old file and in the new. */
const HUNK_START = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
/** `\ No newline at end of file` is a note on the line above, not a line of the file. */
const NOTE = '\\';
/** How git marks a binary file in a diff: `Binary files a/x and b/x differ`, or a binary patch. */
const BINARY = /^(Binary files .* differ|GIT binary patch)$/;
/** An empty line still takes a line's height: its missing sign is drawn as a space. */
const BLANK = ' ';

const isAdded = (line: string): boolean => line.startsWith('+') && !line.startsWith('+++');
const isRemoved = (line: string): boolean => line.startsWith('-') && !line.startsWith('---');

/** The path after the change: the header's own when the file kept its path, else the rename's. */
function newPathOf(lines: readonly string[]): string | null {
  const same = SAME_PATH.exec(lines[0])?.[1];
  if (same) return same;
  for (const line of lines) {
    if (line.startsWith(HUNK)) return null;
    const renamed = RENAME_TO.exec(line)?.[1];
    if (renamed) return renamed;
  }
  return null;
}

/** A diff split by file, each counted, none of it drawn yet: most are never opened. */
export function diffFilesOf(diff: string): DiffFile[] {
  return diff
    .split(FILE_START)
    .filter((part) => part.startsWith(FILE_HEADER))
    .map((part) => {
      const lines = part.split('\n');
      return {
        path: part.match(PATH)?.[1] ?? UNNAMED,
        newPath: newPathOf(lines),
        isDeleted: lines.some((line) => DELETED_FILE.test(line)),
        additions: lines.filter(isAdded).length,
        deletions: lines.filter(isRemoved).length,
        isBinary:
          !lines.some((line) => line.startsWith(HUNK)) && lines.some((line) => BINARY.test(line)),
        lines,
      };
    });
}

/** A path with its folder apart from the file's name, which is what a reader looks for. */
export function pathPartsOf(path: string): PathParts {
  const slash = path.lastIndexOf('/') + 1;
  return { folder: path.slice(0, slash), name: path.slice(slash) };
}

const kindOf = (line: string): DiffLineKind =>
  line.startsWith(HUNK) ? 'h' : line.startsWith('+') ? 'a' : line.startsWith('-') ? 'd' : '';

/** A file's lines from its first hunk on, each numbered, marked for how it is drawn, and
 *  with the words changed between a removed line and the added one that replaces it. */
export function diffLinesOf(file: DiffFile): DiffLine[] {
  const first = file.lines.findIndex((line) => line.startsWith(HUNK));
  if (first < 0) return [];
  const lines = numbered(withoutTrailingBlanks(file.lines.slice(first)));
  markWordChanges(lines);
  return lines;
}

/** Splitting on newlines leaves an empty tail after the last one; it is not a line. */
function withoutTrailingBlanks(lines: readonly string[]): readonly string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1] === '') end--;
  return lines.slice(0, end);
}

/** Numbers from each hunk header. A header that does not parse leaves its lines unnumbered. */
function numbered(raw: readonly string[]): DiffLine[] {
  let oldNumber: number | null = null;
  let newNumber: number | null = null;
  return raw.map((line): DiffLine => {
    const kind = kindOf(line);
    const unnumbered = { oldNumber: null, newNumber: null, parts: null };
    if (kind === 'h') {
      const start = HUNK_START.exec(line);
      oldNumber = start ? Number(start[1]) : null;
      newNumber = start ? Number(start[2]) : null;
      return { kind, sign: '', text: line, ...unnumbered };
    }
    const sign = line.charAt(0) || BLANK;
    const text = line.slice(1);
    if (sign === NOTE) return { kind, sign, text, ...unnumbered };

    const shown = {
      oldNumber: kind === 'a' ? null : oldNumber,
      newNumber: kind === 'd' ? null : newNumber,
      parts: null,
    };
    if (kind !== 'a' && oldNumber !== null) oldNumber++;
    if (kind !== 'd' && newNumber !== null) newNumber++;
    return { kind, sign, text, ...shown };
  });
}

/**
 * Where a hunk header says the new side's lines begin, or null when it cannot be read. A hunk
 * that adds nothing names the line before its place, so the removed lines sit after that one.
 */
export function newSideStartOf(header: string): number | null {
  const start = NEW_SIDE.exec(header);
  if (!start) return null;
  return Number(start[1]) + (start[2] === '0' ? 1 : 0);
}

/** Each run of removed lines is paired, line by line, with the added run that follows it. */
export function markWordChanges(lines: DiffLine[]): void {
  let start = 0;
  while (start < lines.length) {
    const removedEnd = runEnd(lines, start, 'd');
    const addedEnd = runEnd(lines, removedEnd, 'a');
    const pairs = Math.min(removedEnd - start, addedEnd - removedEnd);
    for (let pair = 0; pair < pairs; pair++) {
      const removed = lines[start + pair];
      const added = lines[removedEnd + pair];
      const changes = wordChangesOf(removed.text, added.text);
      if (!changes) continue;
      lines[start + pair] = { ...removed, parts: changes.removed };
      lines[removedEnd + pair] = { ...added, parts: changes.added };
    }
    start = Math.max(addedEnd, start + 1);
  }
}

function runEnd(lines: readonly DiffLine[], from: number, kind: DiffLineKind): number {
  let end = from;
  while (end < lines.length && lines[end].kind === kind) end++;
  return end;
}
