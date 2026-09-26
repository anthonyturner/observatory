import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequest } from '../http/api-server.ts';
import { repoNameFrom } from './repo-name.ts';

describe('repoNameFrom', () => {
  it('accepts an owner/name', () => {
    assert.equal(
      repoNameFrom('anthonyturner/rivals-pulse_web.v2'),
      'anthonyturner/rivals-pulse_web.v2',
    );
  });

  it('refuses anything that is not a repository name', () => {
    for (const bad of [
      null,
      '',
      'noslash',
      'a/b/c',
      '../etc',
      'me/..',
      'me/a b',
      '-x/y',
      'me/--help',
    ]) {
      assert.throws(() => repoNameFrom(bad), BadRequest, String(bad));
    }
  });
});
