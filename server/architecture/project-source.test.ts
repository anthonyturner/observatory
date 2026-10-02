import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { windowsIn } from './project-source.ts';

describe('windowsIn', () => {
  it('lists the window names a manifest declares', () => {
    const manifest = JSON.stringify({ data: { windows: { background: {}, desktop: {} } } });
    assert.deepEqual(windowsIn(manifest), ['background', 'desktop']);
  });

  it('returns none when the manifest declares no windows', () => {
    assert.deepEqual(windowsIn(JSON.stringify({ data: {} })), []);
    assert.deepEqual(windowsIn(JSON.stringify({})), []);
  });

  it('returns none when the manifest is not an object', () => {
    assert.deepEqual(windowsIn('[1, 2]'), []);
  });
});
