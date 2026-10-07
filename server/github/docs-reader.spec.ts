import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFilePaths, readFileText, treePathsOf } from './docs-reader.ts';

describe('treePathsOf', () => {
  it('lists the files in a tree, not its folders or odd entries', () => {
    const body = {
      tree: [
        { path: 'docs', type: 'tree' },
        { path: 'docs/a.md', type: 'blob' },
        { path: 7, type: 'blob' },
        'junk',
      ],
    };

    assert.deepEqual(treePathsOf(body), ['docs/a.md']);
    assert.deepEqual(treePathsOf(null), []);
  });
});

describe('the docs reads', () => {
  it('asks for the whole tree and one file’s contents, encoded', async () => {
    const asked: string[] = [];
    const get = async (path: string): Promise<unknown> => {
      asked.push(path);
      return path.includes('/contents/')
        ? { encoding: 'base64', content: Buffer.from('# Hi').toString('base64') }
        : { tree: [] };
    };

    await readFilePaths(get, 'me/app', 'main');
    const text = await readFileText(get, 'me/app', 'docs/a b.md', 'release/1');

    assert.equal(text, '# Hi');
    assert.deepEqual(asked, [
      'repos/me/app/git/trees/main?recursive=1',
      'repos/me/app/contents/docs/a%20b.md?ref=release%2F1',
    ]);
  });
});
