import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileCloneFinder, scanClones } from './clone-finder.ts';

function checkout(dir: string, url: string): string {
  mkdirSync(join(dir, '.git'), { recursive: true });
  writeFileSync(join(dir, '.git', 'config'), `[remote "origin"]\n\turl = ${url}\n`);
  return dir;
}

function tree() {
  const root = mkdtempSync(join(tmpdir(), 'observatory-clones-'));
  const shallow = checkout(join(root, 'a'), 'https://github.com/me/a.git');
  checkout(join(root, 'deep', 'er', 'b'), 'git@github.com:me/b.git');
  checkout(join(root, 'x', 'a-copy'), 'https://github.com/me/a.git');
  checkout(join(root, 'a', 'nested'), 'https://github.com/me/nested.git');
  checkout(join(root, 'node_modules', 'c'), 'https://github.com/me/c.git');
  mkdirSync(join(root, 'wt'));
  writeFileSync(join(root, 'wt', '.git'), 'gitdir: elsewhere');
  return { root, shallow };
}

describe('scanClones', () => {
  it('finds primary checkouts by origin, shallowest first, and not inside one another', () => {
    const { root, shallow } = tree();

    const clones = scanClones(root);

    assert.equal(clones.get('me/a'), shallow);
    assert.ok(clones.has('me/b'));
    assert.equal(clones.has('me/nested'), false);
    assert.equal(clones.has('me/c'), false);
  });

  it('stops at the depth it is given', () => {
    assert.equal(scanClones(tree().root, 2).has('me/b'), false);
  });
});

describe('fileCloneFinder', () => {
  it('prefers a listed checkout, whatever the case of the name', async () => {
    const { root } = tree();
    const listed = checkout(join(root, 'elsewhere', 'mine'), 'https://github.com/me/a.git');
    const overrides = join(root, 'clones.json');
    writeFileSync(overrides, JSON.stringify({ 'Me/A': listed, 'me/gone': join(root, 'nope') }));

    const finder = fileCloneFinder(root, overrides);

    assert.equal(await finder.cloneOf('me/a'), listed);
    assert.equal(await finder.cloneOf('me/gone'), null);
    assert.equal(await finder.cloneOf('me/unknown'), null);
  });
});
