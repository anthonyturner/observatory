import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SiteAddress } from './site-address.ts';

const ASSIGNED = 'http://localhost:54321/';

const passPolls = (address: SiteAddress, count: number): void => {
  for (let poll = 0; poll < count; poll += 1) address.pass();
};

describe('SiteAddress', () => {
  it('names nothing at first, then the assigned port once nothing better has come', () => {
    const address = new SiteAddress(null, ASSIGNED);

    assert.equal(address.candidate(), null);
    passPolls(address, 2);
    assert.equal(address.candidate(), null);
    passPolls(address, 1);
    assert.equal(address.candidate(), ASSIGNED);
  });

  it('names nothing without an assigned port or a printed address', () => {
    const address = new SiteAddress(null, null);

    passPolls(address, 10);

    assert.equal(address.candidate(), null);
  });

  it('prefers the first printed address to the assigned port, after a short wait', () => {
    const address = new SiteAddress(null, ASSIGNED);
    passPolls(address, 5);

    address.hear('api listening on http://localhost:3001/');
    address.hear('also http://localhost:3002/');
    assert.equal(address.candidate(), null, 'it waits for a Local: one first');
    passPolls(address, 3);

    assert.equal(address.candidate(), 'http://localhost:3001/');
  });

  it('prefers an address labelled Local: to any other, at once', () => {
    const address = new SiteAddress(null, ASSIGNED);
    address.hear('api listening on http://localhost:3001/');

    address.hear(
      '  \u001B[32m➜\u001B[39m  Local:   \u001B[36mhttp://localhost:\u001B[1m5173\u001B[22m/\u001B[39m',
    );
    address.hear('  Local:   http://localhost:5174/');

    assert.equal(address.candidate(), 'http://localhost:5173/');
  });

  it('prefers the owner’s address to everything the server says', () => {
    const address = new SiteAddress('https://app.test:8443/', ASSIGNED);

    address.hear('Local: http://localhost:5173/');

    assert.equal(address.candidate(), 'https://app.test:8443/');
  });

  it('ignores output that holds no address on this machine', () => {
    const address = new SiteAddress(null, null);

    address.hear('Network: http://192.168.1.5:5173/');
    address.hear('compiled in 3s');
    passPolls(address, 10);

    assert.equal(address.candidate(), null);
  });
});
