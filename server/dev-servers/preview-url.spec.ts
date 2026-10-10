import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localUrlIn } from './preview-url.ts';

describe('localUrlIn', () => {
  it('finds the address a dev server prints', () => {
    assert.equal(localUrlIn('  ➜  Local:   http://localhost:5173/'), 'http://localhost:5173/');
    assert.equal(localUrlIn('Local:   http://localhost:4200/'), 'http://localhost:4200/');
    assert.equal(localUrlIn('ready on http://127.0.0.1:3000'), 'http://127.0.0.1:3000');
  });

  it('reads through the colour codes wrapped around the port', () => {
    const line =
      '  \u001B[32m➜\u001B[39m  Local:   \u001B[36mhttp://localhost:\u001B[1m5173\u001B[22m/\u001B[39m';

    assert.equal(localUrlIn(line), 'http://localhost:5173/');
  });

  it('keeps the path the server printed', () => {
    assert.equal(localUrlIn('http://localhost:3000/app/'), 'http://localhost:3000/app/');
  });

  it('ignores addresses that are not on this machine and lines with none', () => {
    assert.equal(localUrlIn('Network: http://192.168.1.4:5173/'), null);
    assert.equal(localUrlIn('docs at https://vite.dev/guide'), null);
    assert.equal(localUrlIn('http://localhost without a port'), null);
    assert.equal(localUrlIn('compiled successfully'), null);
  });
});
