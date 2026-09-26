import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { argOf, namesTarget, pushTargetFrom } from './push-target.ts';

describe('pushTargetFrom', () => {
  const saved = { site: 'https://saved.example', token: 'saved-token' };

  it('takes arguments over the environment over what was remembered', () => {
    const args = ['--site=https://arg.example/', '--token=arg-token'];
    const env = { OBSERVATORY_SITE: 'https://env.example', OBSERVATORY_PUSH_TOKEN: 'env-token' };

    assert.deepEqual(pushTargetFrom(args, env, saved), {
      site: 'https://arg.example',
      token: 'arg-token',
    });
    assert.deepEqual(pushTargetFrom([], env, saved), {
      site: 'https://env.example',
      token: 'env-token',
    });
    assert.deepEqual(pushTargetFrom([], {}, saved), saved);
  });

  it('has no target while either half is missing', () => {
    assert.equal(pushTargetFrom(['--site=https://x.example'], {}, null), null);
    assert.equal(pushTargetFrom([], {}, { site: 5 }), null);
  });

  it('remembers only a run that named its target', () => {
    assert.equal(namesTarget(['--token=t']), true);
    assert.equal(namesTarget(['--repo=me/app']), false);
    assert.equal(argOf(['--repo=me/app'], 'repo'), 'me/app');
  });
});
