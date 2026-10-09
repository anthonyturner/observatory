import { diffFilesOf, diffLinesOf, pathPartsOf } from './diff-files';

const DIFF = [
  'diff --git a/src/app.ts b/src/app.ts',
  'index 1..2 100644',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1,2 +1,2 @@',
  ' same',
  '-old',
  '+new',
  '',
  'diff --git a/README.md b/README.md',
  '--- a/README.md',
  '+++ b/README.md',
  '@@ -0,0 +1 @@',
  '+<script>alert(1)</script>',
].join('\n');

describe('diffFilesOf', () => {
  it('splits a diff by file and counts what each adds and removes', () => {
    const files = diffFilesOf(DIFF);

    expect(files.map(({ path, additions, deletions }) => [path, additions, deletions])).toEqual([
      ['src/app.ts', 1, 1],
      ['README.md', 1, 0],
    ]);
  });

  it('marks a file git sent as binary, and only that one', () => {
    const binary = [
      'diff --git a/logo.png b/logo.png',
      'new file mode 100644',
      'Binary files /dev/null and b/logo.png differ',
    ].join('\n');

    expect(diffFilesOf(`${DIFF}\n${binary}`).map((file) => file.isBinary)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('finds no files in an empty diff', () => {
    expect(diffFilesOf('')).toEqual([]);
  });
});

describe('pathPartsOf', () => {
  it('keeps the folder apart from the file name', () => {
    expect(pathPartsOf('src/app/app.ts')).toEqual({ folder: 'src/app/', name: 'app.ts' });
    expect(pathPartsOf('README.md')).toEqual({ folder: '', name: 'README.md' });
  });
});

describe('diffLinesOf', () => {
  const diffOf = (...lines: string[]) =>
    diffFilesOf(['diff --git a/x.ts b/x.ts', ...lines].join('\n'))[0];

  it('draws a file from its first hunk, marking and numbering each line', () => {
    const [app, readme] = diffFilesOf(DIFF);

    expect(diffLinesOf(app)).toEqual([
      {
        kind: 'h',
        sign: '',
        text: '@@ -1,2 +1,2 @@',
        oldNumber: null,
        newNumber: null,
        parts: null,
      },
      { kind: '', sign: ' ', text: 'same', oldNumber: 1, newNumber: 1, parts: null },
      { kind: 'd', sign: '-', text: 'old', oldNumber: 2, newNumber: null, parts: null },
      { kind: 'a', sign: '+', text: 'new', oldNumber: null, newNumber: 2, parts: null },
    ]);
    expect(diffLinesOf(readme).at(-1)).toEqual({
      kind: 'a',
      sign: '+',
      text: '<script>alert(1)</script>',
      oldNumber: null,
      newNumber: 1,
      parts: null,
    });
  });

  it('restarts the numbers at each hunk and skips a "no newline" note', () => {
    const file = diffOf(
      '@@ -10,2 +10,2 @@ fn()',
      ' a',
      '-b',
      '\\ No newline at end of file',
      '+c',
      '@@ -40 +50,2 @@',
      '+d',
      ' e',
    );

    expect(diffLinesOf(file).map(({ oldNumber, newNumber }) => [oldNumber, newNumber])).toEqual([
      [null, null],
      [10, 10],
      [11, null],
      [null, null],
      [null, 11],
      [null, null],
      [null, 50],
      [40, 51],
    ]);
  });

  it('leaves lines unnumbered when the hunk header cannot be read', () => {
    const file = diffOf('@@@ -1 -1 +1 @@@', '+x');

    expect(diffLinesOf(file).map(({ newNumber }) => newNumber)).toEqual([null, null]);
  });

  it('pairs a removed run with the added run after it, line by line', () => {
    const lines = diffLinesOf(
      diffOf(
        '@@ -1,3 +1,2 @@',
        '-let a = first(1);',
        '-let b = other(2);',
        '-let c = gone();',
        '+let a = second(1);',
        '+let b = other(3);',
      ),
    );

    const changed = (index: number) =>
      lines[index].parts?.filter((span) => span.changed).map((span) => span.text);
    expect(changed(1)).toEqual(['first']);
    expect(changed(2)).toEqual(['2']);
    expect(changed(3)).toBeUndefined();
    expect(changed(4)).toEqual(['second']);
    expect(changed(5)).toEqual(['3']);
  });

  it('draws no lines for a file git sent with no hunk', () => {
    expect(diffLinesOf(diffOf('similarity index 100%', 'rename from a.ts'))).toEqual([]);
  });
});
