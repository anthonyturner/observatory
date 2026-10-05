import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { holdMarker } from './hold-marker.ts';

describe('holdMarker', () => {
  let root = '';
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'observatory-hold-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const marker = () => join(root, '.jev-speaking');

  it('writes one ASCII line, expiry then token, and leaves no temp file behind', () => {
    holdMarker({ root }).write(1_000_006_000, 'tab-1');

    assert.equal(readFileSync(marker(), 'ascii'), '1000006000|tab-1');
    assert.deepEqual(readdirSync(root), ['.jev-speaking']);
  });

  it('removes the marker when cleared, and minds no marker at all', () => {
    const hold = holdMarker({ root });
    hold.write(1_000_006_000, 'tab-1');

    hold.clear(1_000_000_000, 'tab-1');
    hold.clear(1_000_000_000, 'tab-1');

    assert.equal(existsSync(marker()), false);
  });

  /** A rename that fails with `code` for its first `failures` calls, as
   *  Windows does while Agent Speak has the marker open. */
  function lockedRename(code: string, failures: number) {
    const calls: string[] = [];
    const rename = (from: string, to: string): void => {
      calls.push('rename');
      if (calls.length <= failures) throw Object.assign(new Error(code), { code });
      renameSync(from, to);
    };
    return { rename, calls };
  }

  it('tries the rename again, after a pause, while Agent Speak has the marker open', () => {
    const { rename, calls } = lockedRename('EPERM', 1);
    const pauses: number[] = [];
    const warnings: string[] = [];

    holdMarker({
      root,
      rename,
      pause: (ms) => pauses.push(ms),
      warn: (message) => warnings.push(message),
    }).write(1_000_006_000, 'tab-1');

    assert.equal(readFileSync(marker(), 'ascii'), '1000006000|tab-1');
    assert.equal(calls.length, 2);
    assert.equal(pauses.length, 1);
    assert.ok(pauses[0] > 0 && pauses[0] <= 10);
    assert.deepEqual(warnings, []);
  });

  it('gives up after a few tries, or at once on any other failure, and warns', () => {
    const locked = lockedRename('EBUSY', 99);
    const broken = lockedRename('EACCES', 99);
    const warnings: string[] = [];
    const quiet = {
      root,
      pause: () => undefined,
      warn: (message: string) => warnings.push(message),
    };

    holdMarker({ ...quiet, rename: locked.rename }).write(1, 'tab-1');
    holdMarker({ ...quiet, rename: broken.rename }).write(1, 'tab-1');

    assert.equal(locked.calls.length, 3);
    assert.equal(broken.calls.length, 1);
    assert.equal(warnings.length, 2);
    assert.equal(existsSync(marker()), false);
  });

  it('writes nothing where Agent Speak is not installed', () => {
    const missing = join(root, 'agent-speak');
    const warnings: string[] = [];

    holdMarker({ root: missing, warn: (message) => warnings.push(message) }).write(1, 'tab-1');

    assert.equal(existsSync(missing), false);
    assert.deepEqual(warnings, []);
  });
});
