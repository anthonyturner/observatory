import { DiffLine, diffFilesOf, diffLinesOf, markWordChanges, newSideStartOf } from './diff-files';

/** A file in full, with the changes a pull request made to it laid over its lines. */
export interface WholeFile {
  readonly lines: readonly DiffLine[];
  /** Where each run of changed lines starts in `lines`, in order. */
  readonly changes: readonly number[];
  /** The changes do not fit the text, as when they were made to another version of the file,
   *  so none is marked rather than a wrong line. */
  readonly isMismatched: boolean;
}

const CARRIAGE_RETURN = /\r$/;
const NOTE = '\\';

const withoutReturn = (text: string): string => text.replace(CARRIAGE_RETURN, '');

/** The text's lines; a final newline ends the last line and does not start another. */
function linesOf(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n').map(withoutReturn);
  if (text.endsWith('\n')) lines.pop();
  return lines;
}

/** What the changes say about the new file's lines. */
interface Marks {
  /** The new file's line numbers that the change added. */
  readonly added: ReadonlySet<number>;
  /** The removed lines that sat just before each new line number, in their old order. */
  readonly removedBefore: ReadonlyMap<number, readonly DiffLine[]>;
}

/** Reads the changes against the file's lines, or null when any line they keep is not that line of the file. */
function marksOf(hunks: readonly DiffLine[], fileLines: readonly string[]): Marks | null {
  const added = new Set<number>();
  const removedBefore = new Map<number, DiffLine[]>();
  let next = 0;
  for (const line of hunks) {
    if (line.kind === 'h') {
      const start = newSideStartOf(line.text);
      if (start === null) return null;
      next = start;
    } else if (line.sign === NOTE) {
      continue;
    } else if (line.kind === 'd') {
      const removed = { ...line, text: withoutReturn(line.text), parts: null };
      removedBefore.set(next, [...(removedBefore.get(next) ?? []), removed]);
    } else {
      if (line.newNumber === null || fileLines[line.newNumber - 1] !== withoutReturn(line.text)) {
        return null;
      }
      if (line.kind === 'a') added.add(line.newNumber);
      next = line.newNumber + 1;
    }
  }
  const lastPlace = fileLines.length + 1;
  if ([...removedBefore.keys()].some((place) => place > lastPlace)) return null;
  return { added, removedBefore };
}

const contextLine = (text: string, oldNumber: number, newNumber: number): DiffLine => ({
  kind: '',
  sign: ' ',
  text,
  oldNumber,
  newNumber,
  parts: null,
});

const addedLine = (text: string, newNumber: number): DiffLine => ({
  kind: 'a',
  sign: '+',
  text,
  oldNumber: null,
  newNumber,
  parts: null,
});

/** Every line of the file, unmarked. */
function plain(fileLines: readonly string[], isMismatched: boolean): WholeFile {
  return {
    lines: fileLines.map((text, index) => contextLine(text, index + 1, index + 1)),
    changes: [],
    isMismatched,
  };
}

/**
 * The file with the changes laid over it: added lines marked, and each removed line placed
 * just before the line that now stands where it was. `patch` is the file's section of a
 * unified diff, empty for a file with no changes.
 */
export function wholeFileOf(text: string, patch: string): WholeFile {
  const fileLines = linesOf(text);
  const section = diffFilesOf(patch)[0];
  const hunks = section ? diffLinesOf(section) : [];
  if (hunks.length === 0) return plain(fileLines, false);
  const marks = marksOf(hunks, fileLines);
  if (!marks) return plain(fileLines, true);

  const lines: DiffLine[] = [];
  const changes: number[] = [];
  let oldNumber = 1;
  const place = (line: DiffLine): void => {
    if (line.kind !== '' && (lines.length === 0 || lines[lines.length - 1].kind === '')) {
      changes.push(lines.length);
    }
    lines.push(line);
  };
  for (let newNumber = 1; newNumber <= fileLines.length + 1; newNumber++) {
    for (const removed of marks.removedBefore.get(newNumber) ?? []) {
      place(removed);
      oldNumber = (removed.oldNumber ?? oldNumber) + 1;
    }
    if (newNumber > fileLines.length) break;
    const content = fileLines[newNumber - 1];
    place(
      marks.added.has(newNumber)
        ? addedLine(content, newNumber)
        : contextLine(content, oldNumber++, newNumber),
    );
  }
  markWordChanges(lines);
  return { lines, changes, isMismatched: false };
}
