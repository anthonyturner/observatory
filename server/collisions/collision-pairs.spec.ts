import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { conflictedFiles, githubRepoOf, originUrlOf, sharedPairs } from './collision-pairs.ts';

describe('sharedPairs', () => {
  it('pairs pull requests that change a file in common, lower number first', () => {
    const pairs = sharedPairs([
      { number: 9, files: ['a.ts', 'b.ts'] },
      { number: 3, files: ['b.ts', 'c.ts'] },
      { number: 5, files: ['d.ts'] },
      { number: 7, files: ['c.ts', 'b.ts'] },
    ]);

    assert.deepEqual(pairs, [
      { a: 3, b: 7, files: ['c.ts', 'b.ts'] },
      { a: 3, b: 9, files: ['b.ts'] },
      { a: 7, b: 9, files: ['b.ts'] },
    ]);
  });
});

describe('githubRepoOf', () => {
  it('reads HTTPS and SSH remotes on GitHub, and nothing else', () => {
    assert.equal(githubRepoOf('https://github.com/Me/Repo.git'), 'me/repo');
    assert.equal(githubRepoOf('git@github.com:me/rivals_pulse.git'), 'me/rivals_pulse');
    assert.equal(githubRepoOf('https://github.com/me/pr-starmap'), 'me/pr-starmap');
    assert.equal(githubRepoOf('https://gitlab.com/me/repo.git'), null);
  });
});

describe('originUrlOf', () => {
  it('finds origin among the remotes', () => {
    const config = [
      '[core]',
      '\tbare = false',
      '[remote "upstream"]',
      '\turl = https://github.com/them/repo.git',
      '[remote "origin"]',
      '\turl = git@github.com:me/repo.git',
      '\tfetch = +refs/heads/*:refs/remotes/origin/*',
    ].join('\r\n');

    assert.equal(originUrlOf(config), 'git@github.com:me/repo.git');
    assert.equal(originUrlOf('[core]\n\tbare = false\n'), null);
  });
});

describe('conflictedFiles', () => {
  it('reads the files after the tree, once each', () => {
    assert.deepEqual(conflictedFiles('4b825dc\nsrc/a.ts\nsrc/a.ts\nsrc/b.ts\n'), [
      'src/a.ts',
      'src/b.ts',
    ]);
    assert.deepEqual(conflictedFiles('4b825dc\n'), []);
  });
});
