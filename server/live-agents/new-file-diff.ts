/** A file git does not track, as read from disk. */
export interface NewFile {
  readonly path: string;
  readonly content: Buffer;
  readonly mode: NewFileMode;
}

export type NewFileMode = '100644' | '100755' | '120000';

/** Git calls a file binary when a NUL byte shows in its first 8000 bytes (`buffer_is_binary`). */
const BINARY_SNIFF_BYTES = 8000;
const NUL = 0;
const NO_NEWLINE = '\\ No newline at end of file';

export const isBinary = (content: Buffer): boolean =>
  content.subarray(0, BINARY_SNIFF_BYTES).includes(NUL);

/** Git ends a `+++` name that holds a space with a tab, so the name's end is plain. */
const markedName = (path: string): string => (path.includes(' ') ? `${path}\t` : path);

/** The hunk header: git leaves out a count of one. */
const rangeOf = (count: number): string => (count === 1 ? '+1' : `+1,${count}`);

function addedLines(text: string): string[] {
  const endsInNewline = text.endsWith('\n');
  const lines = (endsInNewline ? text.slice(0, -1) : text).split('\n');
  const added = [`@@ -0,0 ${rangeOf(lines.length)} @@`, ...lines.map((line) => `+${line}`)];
  return endsInNewline ? added : [...added, NO_NEWLINE];
}

/**
 * `file` as git prints it from `git diff --no-index -- /dev/null <path>`,
 * without the `index` line. A binary file is named and none of it is sent.
 */
export function newFileDiff({ path, content, mode }: NewFile): string {
  const header = [`diff --git a/${path} b/${path}`, `new file mode ${mode}`];
  if (isBinary(content)) {
    return [...header, `Binary files /dev/null and b/${path} differ`, ''].join('\n');
  }
  if (content.length === 0) return [...header, ''].join('\n');
  const body = addedLines(content.toString('utf8'));
  return [...header, '--- /dev/null', `+++ b/${markedName(path)}`, ...body, ''].join('\n');
}
