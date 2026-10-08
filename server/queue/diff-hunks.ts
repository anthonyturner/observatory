/** One line of a hunk as the new file has it. */
export interface HunkLine {
  readonly text: string;
  /** Its line number in the new file. */
  readonly line: number;
  /** Added by the change, rather than context around it. */
  readonly isAdded: boolean;
}

/** A run of the new file a unified diff shows: added lines with their context. */
export interface Hunk {
  readonly path: string;
  readonly lines: readonly HunkLine[];
}

const NEW_PATH = /^\+\+\+ (?:b\/)?(.*)$/;
const HUNK_START = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const DELETED = '/dev/null';

/**
 * The hunks of a unified diff, each as the new side reads: removed lines are
 * dropped, and every kept line carries its new line number. A deleted file
 * has no new side, so it gives no hunk.
 */
export function hunksOf(diff: string): Hunk[] {
  const hunks: Hunk[] = [];
  let path: string | null = null;
  let lines: HunkLine[] | null = null;
  let next = 0;
  for (const raw of diff.split('\n')) {
    const text = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (text.startsWith('diff --git ')) {
      path = null;
      lines = null;
      continue;
    }
    const newPath = NEW_PATH.exec(text);
    if (newPath && lines === null) {
      path = newPath[1] === DELETED ? null : newPath[1];
      continue;
    }
    const start = HUNK_START.exec(text);
    if (start) {
      lines = [];
      next = Number(start[1]);
      if (path !== null) hunks.push({ path, lines });
      continue;
    }
    if (lines === null) continue;
    if (text.startsWith('+')) lines.push({ text: text.slice(1), line: next++, isAdded: true });
    else if (text.startsWith(' '))
      lines.push({ text: text.slice(1), line: next++, isAdded: false });
  }
  return hunks;
}
