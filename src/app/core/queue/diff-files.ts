/** One file of a unified diff, its lines kept raw until it is opened. */
export interface DiffFile {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
  readonly lines: readonly string[];
}

/** `h` a hunk header, `a` an added line, `d` a removed one, `''` context. */
export type DiffLineKind = 'h' | 'a' | 'd' | '';

export interface DiffLine {
  readonly kind: DiffLineKind;
  readonly text: string;
}

const FILE_START = /^(?=diff --git )/m;
const FILE_HEADER = 'diff --git';
const PATH = /^diff --git a\/(.+?) b\//;
const UNNAMED = 'file';
const HUNK = '@@';
/** An empty line still takes a line's height. */
const BLANK = ' ';

const isAdded = (line: string): boolean => line.startsWith('+') && !line.startsWith('+++');
const isRemoved = (line: string): boolean => line.startsWith('-') && !line.startsWith('---');

/** A diff split by file, each counted, none of it drawn yet: most are never opened. */
export function diffFilesOf(diff: string): DiffFile[] {
  return diff
    .split(FILE_START)
    .filter((part) => part.startsWith(FILE_HEADER))
    .map((part) => {
      const lines = part.split('\n');
      return {
        path: part.match(PATH)?.[1] ?? UNNAMED,
        additions: lines.filter(isAdded).length,
        deletions: lines.filter(isRemoved).length,
        lines,
      };
    });
}

const kindOf = (line: string): DiffLineKind =>
  line.startsWith(HUNK) ? 'h' : line.startsWith('+') ? 'a' : line.startsWith('-') ? 'd' : '';

/** A file's lines from its first hunk on, each marked for how it is drawn. */
export function diffLinesOf(file: DiffFile): DiffLine[] {
  const first = file.lines.findIndex((line) => line.startsWith(HUNK));
  return file.lines.slice(first).map((line) => ({ kind: kindOf(line), text: line || BLANK }));
}
