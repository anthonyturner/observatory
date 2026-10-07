/** One file of a unified diff, its lines kept raw until it is opened. */
export interface DiffFile {
  readonly path: string;
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
}

const FILE_START = /^(?=diff --git )/m;
const FILE_HEADER = 'diff --git';
const PATH = /^diff --git a\/(.+?) b\//;
const UNNAMED = 'file';
const HUNK = '@@';
/** How git marks a binary file in a diff: `Binary files a/x and b/x differ`, or a binary patch. */
const BINARY = /^(Binary files .* differ|GIT binary patch)$/;
/** An empty line still takes a line's height: its missing sign is drawn as a space. */
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
        isBinary:
          !lines.some((line) => line.startsWith(HUNK)) && lines.some((line) => BINARY.test(line)),
        lines,
      };
    });
}

const kindOf = (line: string): DiffLineKind =>
  line.startsWith(HUNK) ? 'h' : line.startsWith('+') ? 'a' : line.startsWith('-') ? 'd' : '';

const lineOf = (line: string): DiffLine => {
  const kind = kindOf(line);
  if (kind === 'h') return { kind, sign: '', text: line };
  return { kind, sign: line.charAt(0) || BLANK, text: line.slice(1) };
};

/** A file's lines from its first hunk on, each marked for how it is drawn. */
export function diffLinesOf(file: DiffFile): DiffLine[] {
  const first = file.lines.findIndex((line) => line.startsWith(HUNK));
  return file.lines.slice(first).map(lineOf);
}
