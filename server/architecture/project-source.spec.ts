import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aliasesIn, windowsIn } from './project-source.ts';

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

describe('aliasesIn', () => {
  it('reads wildcard paths from a tsconfig with comments, against its baseUrl', () => {
    const tsconfig = `{
      // comments are allowed here
      "compilerOptions": {
        "baseUrl": "./",
        "paths": { "@/*": ["./src/*"], "@env": ["src/env.ts"], "@core/*": ["src/app/core/*"] }
      }
    }`;
    assert.deepEqual(aliasesIn(tsconfig), [
      { prefix: '@/', target: 'src/' },
      { prefix: '@core/', target: 'src/app/core/' },
    ]);
  });

  it('returns none without compiler paths', () => {
    assert.deepEqual(aliasesIn('{}'), []);
    assert.deepEqual(aliasesIn('{ "compilerOptions": {} }'), []);
  });
});
