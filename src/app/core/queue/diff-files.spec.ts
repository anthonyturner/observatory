import { diffFilesOf, diffLinesOf } from './diff-files';

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

describe('diffLinesOf', () => {
  it('draws a file from its first hunk, marking each line', () => {
    const [app, readme] = diffFilesOf(DIFF);

    expect(diffLinesOf(app)).toEqual([
      { kind: 'h', sign: '', text: '@@ -1,2 +1,2 @@' },
      { kind: '', sign: ' ', text: 'same' },
      { kind: 'd', sign: '-', text: 'old' },
      { kind: 'a', sign: '+', text: 'new' },
      { kind: '', sign: ' ', text: '' },
      { kind: '', sign: ' ', text: '' },
    ]);
    expect(diffLinesOf(readme).at(-1)).toEqual({
      kind: 'a',
      sign: '+',
      text: '<script>alert(1)</script>',
    });
  });
});
