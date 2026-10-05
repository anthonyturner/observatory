import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
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

  it('writes nothing where Agent Speak is not installed', () => {
    const missing = join(root, 'agent-speak');
    const warnings: string[] = [];

    holdMarker({ root: missing, warn: (message) => warnings.push(message) }).write(1, 'tab-1');

    assert.equal(existsSync(missing), false);
    assert.deepEqual(warnings, []);
  });
});
