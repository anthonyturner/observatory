import { DiffLine } from './diff-files';
import { wholeFileOf } from './whole-file';

const patchOf = (...lines: string[]): string =>
  ['diff --git a/x.ts b/x.ts', '--- a/x.ts', '+++ b/x.ts', ...lines, ''].join('\n');

const shape = (lines: readonly DiffLine[]): string[] =>
  lines.map((line) => `${line.oldNumber ?? '-'}|${line.newNumber ?? '-'}|${line.sign}${line.text}`);

describe('wholeFileOf', () => {
  it('lays a replaced line out as the removed line, then the added one, among all the others', () => {
    const file = wholeFileOf(
      'one\ntwo\nTHREE\nfour\nfive\n',
      patchOf('@@ -2,3 +2,3 @@', ' two', '-three', '+THREE', ' four'),
    );

    expect(shape(file.lines)).toEqual([
      '1|1| one',
      '2|2| two',
      '3|-|-three',
      '-|3|+THREE',
      '4|4| four',
      '5|5| five',
    ]);
    expect(file.changes).toEqual([2]);
    expect(file.isMismatched).toBe(false);
  });

  it('puts each removed line before the line now in its place, in two hunks, with the old numbers kept in step', () => {
    const file = wholeFileOf(
      'a\nc\nd\ne\nf\ng\nh\nI\nj\n',
      patchOf('@@ -1,3 +1,2 @@', ' a', '-b', ' c', '@@ -7,3 +6,4 @@', ' g', ' h', '+I', ' j'),
    );

    expect(shape(file.lines)).toEqual([
      '1|1| a',
      '2|-|-b',
      '3|2| c',
      '4|3| d',
      '5|4| e',
      '6|5| f',
      '7|6| g',
      '8|7| h',
      '-|8|+I',
      '9|9| j',
    ]);
    expect(file.changes).toEqual([1, 8]);
  });

  it('indexes a run of added and removed lines as one change', () => {
    const file = wholeFileOf(
      'a\nB\nC\nd\ne\nf',
      patchOf('@@ -1,5 +1,5 @@', ' a', '-b', '-c', '+B', '+C', ' d', ' e'),
    );

    expect(file.changes).toEqual([1]);
    expect(file.lines.map((line) => line.kind)).toEqual(['', 'd', 'd', 'a', 'a', '', '', '']);
  });

  it('puts a removal at the end of the file after its last line', () => {
    const file = wholeFileOf('a\nb\n', patchOf('@@ -1,3 +1,2 @@', ' a', ' b', '-c'));

    expect(shape(file.lines)).toEqual(['1|1| a', '2|2| b', '3|-|-c']);
    expect(file.changes).toEqual([2]);
  });

  it('puts the lines a hunk removes outright, with no context, after the line it names', () => {
    const file = wholeFileOf('a\nb\nc\n', patchOf('@@ -2,2 +1,0 @@', '-x', '-y'));

    expect(shape(file.lines)).toEqual(['1|1| a', '2|-|-x', '3|-|-y', '4|2| b', '5|3| c']);
  });

  it('marks every line of a new file as added', () => {
    const file = wholeFileOf('a\nb', patchOf('@@ -0,0 +1,2 @@', '+a', '+b'));

    expect(file.lines.map((line) => line.kind)).toEqual(['a', 'a']);
    expect(file.changes).toEqual([0]);
  });

  it('marks the words that changed in a replaced line', () => {
    const file = wholeFileOf(
      'const total = price * 2;\n',
      patchOf('@@ -1 +1 @@', '-const total = price * 3;', '+const total = price * 2;'),
    );

    expect(file.lines[0].parts?.some((part) => part.changed)).toBe(true);
    expect(file.lines[1].parts?.some((part) => part.changed)).toBe(true);
  });

  it('reads a Windows file and its changes as the same lines', () => {
    const file = wholeFileOf('a\r\nB\r\n', patchOf('@@ -1,2 +1,2 @@', ' a\r', '-b\r', '+B\r'));

    expect(file.isMismatched).toBe(false);
    expect(shape(file.lines)).toEqual(['1|1| a', '2|-|-b', '-|2|+B']);
  });

  it('skips the note about a missing final newline', () => {
    const file = wholeFileOf(
      'a\nB',
      patchOf(
        '@@ -1,2 +1,2 @@',
        ' a',
        '-b',
        '\\ No newline at end of file',
        '+B',
        '\\ No newline at end of file',
      ),
    );

    expect(shape(file.lines)).toEqual(['1|1| a', '2|-|-b', '-|2|+B']);
  });

  it('shows the file plain, with no changes, when there is no patch', () => {
    const file = wholeFileOf('a\nb\n', '');

    expect(shape(file.lines)).toEqual(['1|1| a', '2|2| b']);
    expect(file.changes).toEqual([]);
    expect(file.isMismatched).toBe(false);
  });

  it('has no lines for an empty file', () => {
    expect(wholeFileOf('', '').lines).toEqual([]);
  });

  it('marks nothing, and says so, when a line the changes keep is not the file’s', () => {
    const file = wholeFileOf('a\nOTHER\nc\n', patchOf('@@ -1,3 +1,3 @@', ' a', '-b', '+B', ' c'));

    expect(file.isMismatched).toBe(true);
    expect(file.changes).toEqual([]);
    expect(file.lines.map((line) => line.kind)).toEqual(['', '', '']);
  });

  it('marks nothing when the changes reach past the end of the file, or a header cannot be read', () => {
    expect(wholeFileOf('a\n', patchOf('@@ -5,2 +5,2 @@', ' e', '+f')).isMismatched).toBe(true);
    expect(wholeFileOf('a\n', patchOf('@@ nonsense @@', ' a', '+b')).isMismatched).toBe(true);
  });
});
