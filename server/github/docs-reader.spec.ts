import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  readFile,
  readFileBytes,
  readFilePaths,
  readFileText,
  treePathsOf,
} from './docs-reader.ts';

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

describe('readFileBytes', () => {
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const asFile = (extra: Record<string, unknown>): Record<string, unknown> => ({
    type: 'file',
    size: PNG.length,
    sha: 'abc123',
    ...extra,
  });
  const base64 = { encoding: 'base64', content: PNG.toString('base64') };
  const LIMIT = 1024;

  it('reads a file’s bytes from its contents', async () => {
    const asked: string[] = [];
    const get = async (path: string): Promise<unknown> => {
      asked.push(path);
      return asFile(base64);
    };

    assert.deepEqual(await readFileBytes(get, 'me/app', 'docs/a b.png', 'main', LIMIT), PNG);
    assert.deepEqual(asked, ['repos/me/app/contents/docs/a%20b.png?ref=main']);
  });

  it('reads a file over 1 MB, which the contents answer leaves out, from its blob', async () => {
    const asked: string[] = [];
    const get = async (path: string): Promise<unknown> => {
      asked.push(path);
      return path.includes('/git/blobs/')
        ? base64
        : asFile({ encoding: 'none', content: '', size: 2_000_000 });
    };

    assert.deepEqual(await readFileBytes(get, 'me/app', 'big.png', 'main', 5_000_000), PNG);
    assert.equal(asked[1], 'repos/me/app/git/blobs/abc123');
  });

  it('reads nothing for a folder, a missing file or one over the limit', async () => {
    const missing = async (): Promise<unknown> => {
      throw new Error('gh: Not Found (HTTP 404)');
    };
    const large = async (): Promise<unknown> => asFile({ ...base64, size: LIMIT + 1 });

    assert.equal(await readFileBytes(async () => [], 'me/app', 'docs', 'main', LIMIT), null);
    assert.equal(await readFileBytes(missing, 'me/app', 'gone.png', 'main', LIMIT), null);
    assert.equal(await readFileBytes(large, 'me/app', 'a.png', 'main', LIMIT), null);
  });

  it('passes on a failure that is not a missing file', async () => {
    const down = async (): Promise<unknown> => {
      throw new Error('HTTP 502');
    };

    await assert.rejects(readFileBytes(down, 'me/app', 'a.png', 'main', LIMIT), /502/);
  });
});

describe('readFile', () => {
  const TEXT = Buffer.from('hello\n');
  const asFile = (extra: Record<string, unknown>): Record<string, unknown> => ({
    type: 'file',
    size: TEXT.length,
    sha: 'abc123',
    encoding: 'base64',
    content: TEXT.toString('base64'),
    ...extra,
  });
  const LIMIT = 1024;

  it('says what it found: the bytes', async () => {
    const read = await readFile(async () => asFile({}), 'me/app', 'a.txt', 'main', LIMIT);

    assert.deepEqual(read, { kind: 'found', bytes: TEXT });
  });

  it('tells a file over the limit, with its size, from one that is not there', async () => {
    const large = async (): Promise<unknown> => asFile({ size: LIMIT + 1 });
    const missing = async (): Promise<unknown> => {
      throw new Error('gh: Not Found (HTTP 404)');
    };

    assert.deepEqual(await readFile(large, 'me/app', 'a.txt', 'main', LIMIT), {
      kind: 'too-large',
      size: LIMIT + 1,
    });
    assert.deepEqual(await readFile(missing, 'me/app', 'a.txt', 'main', LIMIT), {
      kind: 'missing',
    });
    assert.deepEqual(await readFile(async () => [], 'me/app', 'docs', 'main', LIMIT), {
      kind: 'missing',
    });
  });

  it('passes on a failure that is not a missing file', async () => {
    const down = async (): Promise<unknown> => {
      throw new Error('HTTP 502');
    };

    await assert.rejects(readFile(down, 'me/app', 'a.txt', 'main', LIMIT), /502/);
  });
});
