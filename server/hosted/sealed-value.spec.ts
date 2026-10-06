import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cookie, cookiesOf } from './cookies.ts';
import { sealer } from './sealed-value.ts';

const SECRET = 'x'.repeat(32);
const NOW = Date.parse('2026-09-26T12:00:00Z');

describe('sealer', () => {
  it('opens what it sealed until it expires', () => {
    let now = NOW;
    const seal = sealer(SECRET, () => now);
    const token = seal.seal({ login: 'me', exp: NOW + 1000 });

    assert.deepEqual(seal.open(token), { login: 'me', exp: NOW + 1000 });
    now = NOW + 1000;
    assert.equal(seal.open(token), null);
  });

  it('refuses a changed value, another secret, or nothing', () => {
    const seal = sealer(SECRET, () => NOW);
    const token = seal.seal({ login: 'me', exp: NOW + 1000 });
    const [, signature] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ login: 'you', exp: NOW + 1000 })).toString('base64url')}.${signature}`;

    assert.equal(seal.open(forged), null);
    assert.equal(sealer('y'.repeat(32), () => NOW).open(token), null);
    assert.equal(seal.open(undefined), null);
    assert.equal(seal.open('garbage'), null);
  });

  it('needs a secret of 32 characters or more', () => {
    assert.throws(() => sealer('short'), /at least 32/);
  });
});

describe('cookies', () => {
  it('reads cookies by name, decoding values', () => {
    const request = new Request('https://x', { headers: { cookie: 'a=1; b=x%20y; bad=%E0' } });

    assert.equal(cookiesOf(request).get('a'), '1');
    assert.equal(cookiesOf(request).get('b'), 'x y');
    assert.equal(cookiesOf(request).has('bad'), false);
  });

  it('sets a cookie only this site can read, over HTTPS, not sent with other sites’ writes', () => {
    assert.equal(cookie('s', 'v', 60), 's=v; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60');
  });
});
