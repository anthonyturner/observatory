import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPublicAddress, urlProblem } from './address-guard.ts';

describe('isPublicAddress', () => {
  it('lets public addresses through', () => {
    for (const address of ['8.8.8.8', '151.101.1.69', '2606:4700::6810:85e5']) {
      assert.equal(isPublicAddress(address), true, address);
    }
  });

  it('refuses this machine, private networks, link-local, cloud metadata and multicast', () => {
    for (const address of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '192.0.0.8',
      '192.0.2.1',
      '::1',
      '::',
      'fc00::1',
      'fd12::1',
      'fe80::1',
      '::ffff:127.0.0.1',
      '::ffff:10.0.0.1',
      'not an ip',
    ]) {
      assert.equal(isPublicAddress(address), false, address);
    }
  });

  it('does not over-block the public neighbours of private ranges', () => {
    for (const address of ['172.15.0.1', '172.32.0.1', '192.169.0.1', '100.63.0.1', '192.0.66.2']) {
      assert.equal(isPublicAddress(address), true, address);
    }
  });
});

describe('urlProblem', () => {
  const problem = (url: string): string | null => urlProblem(new URL(url));

  it('allows ordinary web pages', () => {
    assert.equal(problem('https://www.reuters.com/technology/'), null);
    assert.equal(problem('http://example.com:80/a'), null);
  });

  it('refuses other schemes, odd ports, logins and local names or addresses', () => {
    assert.match(problem('file:///etc/passwd') ?? '', /only web pages/);
    assert.match(problem('ftp://example.com/') ?? '', /only web pages/);
    assert.match(problem('https://example.com:8443/') ?? '', /ordinary web ports/);
    assert.match(problem('https://user:pw@example.com/') ?? '', /login/);
    assert.match(problem('http://localhost/') ?? '', /this machine/);
    assert.match(problem('http://printer.local/') ?? '', /this machine/);
    assert.match(problem('http://127.0.0.1/') ?? '', /this machine/);
    assert.match(problem('http://[::1]/') ?? '', /this machine/);
    assert.match(problem('http://169.254.169.254/latest/meta-data') ?? '', /this machine/);
  });
});
