import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isLocalLine, localUrlIn } from './preview-url.ts';

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

  it('finds the address on this machine when a list has several', () => {
    assert.equal(
      localUrlIn('Loopback: http://localhost:8080/, http://[::1]:8080/'),
      'http://localhost:8080/',
    );
    assert.equal(localUrlIn('Listening on http://[::1]:8080/'), 'http://[::1]:8080/');
  });

  it('drops the punctuation a sentence puts after an address', () => {
    assert.equal(localUrlIn('Server ready at http://localhost:3000.'), 'http://localhost:3000');
    assert.equal(localUrlIn('see http://localhost:3000/app;'), 'http://localhost:3000/app');
  });

  it('refuses an address whose host is not this machine, however it starts', () => {
    assert.equal(localUrlIn('http://localhost:3000@evil.example/x'), null);
    assert.equal(localUrlIn('http://localhost.evil.example:3000/'), null);
    assert.equal(
      localUrlIn('http://localhost:3000@evil.example/x then http://127.0.0.1:4000/'),
      'http://127.0.0.1:4000/',
    );
  });

  it('ignores addresses that are not on this machine and lines with none', () => {
    assert.equal(localUrlIn('Network: http://192.168.1.4:5173/'), null);
    assert.equal(localUrlIn('docs at https://vite.dev/guide'), null);
    assert.equal(localUrlIn('http://localhost without a port'), null);
    assert.equal(localUrlIn('compiled successfully'), null);
  });
});

describe('isLocalLine', () => {
  it('knows the line that names the site itself', () => {
    assert.equal(isLocalLine('  ➜  Local:   http://localhost:5173/'), true);
    assert.equal(isLocalLine('  \u001B[1mLocal:\u001B[22m http://localhost:5173/'), true);
    assert.equal(isLocalLine('API listening on http://localhost:3001/'), false);
  });
});
