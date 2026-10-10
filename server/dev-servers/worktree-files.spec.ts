import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { nodeWorktreeFiles } from './worktree-files.ts';

const files = nodeWorktreeFiles();
let root = '';

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'observatory-worktree-files-'));
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

const exists = (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false,
  );

describe('nodeWorktreeFiles', () => {
  it('reads a file, and finds no text where there is no file', async () => {
    await writeFile(join(root, 'a.txt'), 'hello');

    assert.equal(await files.read(join(root, 'a.txt')), 'hello');
    assert.equal(await files.read(join(root, 'missing.txt')), null);
  });

  it('adds to a file, making the folders above it', async () => {
    const target = join(root, 'info', 'exclude');

    await files.append(target, 'one\n');
    await files.append(target, 'two\n');

    assert.equal(await readFile(target, 'utf8'), 'one\ntwo\n');
  });

  it('lists files and folders apart, and nothing for a folder that is not there', async () => {
    const folder = join(root, 'listed');
    await mkdir(join(folder, 'sub'), { recursive: true });
    await writeFile(join(folder, '.env'), 'X=1');

    const listed = await files.list(folder);

    assert.deepEqual(
      listed
        .map(({ name, isFile, isFolder }) => ({ name, isFile, isFolder }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      [
        { name: '.env', isFile: true, isFolder: false },
        { name: 'sub', isFile: false, isFolder: true },
      ],
    );
    assert.deepEqual(await files.list(join(root, 'nowhere')), []);
  });

  it('copies a file, and never overwrites one that is there', async () => {
    await writeFile(join(root, 'from.env'), 'NEW=1');
    await writeFile(join(root, 'kept.env'), 'MINE=1');

    await files.copy(join(root, 'from.env'), join(root, 'copy.env'));
    await files.copy(join(root, 'from.env'), join(root, 'kept.env'));

    assert.equal(await readFile(join(root, 'copy.env'), 'utf8'), 'NEW=1');
    assert.equal(await readFile(join(root, 'kept.env'), 'utf8'), 'MINE=1');
  });

  it('knows whether anything is at a path', async () => {
    assert.equal(await files.exists(join(root, 'a.txt')), true);
    assert.equal(await files.exists(join(root, 'missing.txt')), false);
  });

  it('deletes a folder and all it holds, however deep, and succeeds when it is already gone', async () => {
    const deep = join(root, 'tree', ...Array.from({ length: 40 }, () => 'a-long-folder-name'));
    await mkdir(deep, { recursive: true });
    await writeFile(join(deep, 'file.txt'), 'x');

    await files.removeTree(join(root, 'tree'));
    await files.removeTree(join(root, 'tree'));

    assert.equal(await exists(join(root, 'tree')), false);
  });

  it('removes a link inside a folder without following it into what it points at', async () => {
    const outside = join(root, 'outside');
    await mkdir(outside);
    await writeFile(join(outside, 'precious.txt'), 'keep');
    const tree = join(root, 'with-link');
    await mkdir(tree);
    await symlink(outside, join(tree, 'link'), 'junction');

    await files.removeTree(tree);

    assert.equal(await exists(tree), false);
    assert.equal(await readFile(join(outside, 'precious.txt'), 'utf8'), 'keep');
  });

  it('removes a link that is itself the folder asked for, and leaves its target', async () => {
    const outside = join(root, 'outside-two');
    await mkdir(outside);
    await writeFile(join(outside, 'precious.txt'), 'keep');
    const link = join(root, 'the-link');
    await symlink(outside, link, 'junction');

    await files.removeTree(link);

    assert.equal(await exists(link), false);
    assert.equal(await readFile(join(outside, 'precious.txt'), 'utf8'), 'keep');
  });
});
