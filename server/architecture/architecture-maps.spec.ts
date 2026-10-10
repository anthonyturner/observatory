import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CloneFinder } from '../collisions/clone-finder.ts';
import { NotFound } from '../http/api-handler.ts';
import { architectureMaps } from './architecture-maps.ts';
import { SAMPLE_MAP } from './sample-map.ts';
import type { ScanOptions } from './scan-project.ts';

const NOW = Date.parse('2026-10-09T12:00:00.000Z');

function setup() {
  const scanned: { root: string; options: ScanOptions | undefined }[] = [];
  const clones: CloneFinder = { cloneOf: async (repo) => (repo === 'me/app' ? '/work/app' : null) };
  let now = NOW;
  const maps = architectureMaps(
    clones,
    async (root, options) => {
      scanned.push({ root, options });
      return { ...SAMPLE_MAP, project: `scan ${scanned.length}` };
    },
    () => now,
  );
  return { maps, scanned, later: (ms: number) => (now += ms) };
}

describe('architectureMaps', () => {
  it("scans the repository's clone, stamped with the time of the scan", async () => {
    const { maps, scanned } = setup();

    const map = await maps.read('me/app');

    assert.equal(map.project, 'scan 1');
    assert.deepEqual(scanned, [
      { root: '/work/app', options: { scannedAt: '2026-10-09T12:00:00.000Z' } },
    ]);
  });

  it('keeps a map for a while, then scans again', async () => {
    const { maps, scanned, later } = setup();

    await maps.read('me/app');
    later(60_000);
    await maps.read('me/app');
    assert.equal(scanned.length, 1);

    later(5 * 60_000);
    await maps.read('me/app');
    assert.equal(scanned.length, 2);
  });

  it('scans again at once after forget', async () => {
    const { maps, scanned } = setup();

    await maps.read('me/app');
    maps.forget('me/app');
    const map = await maps.read('me/app');

    assert.equal(map.project, 'scan 2');
    assert.equal(scanned.length, 2);
  });

  it('throws NotFound when this machine holds no clone', async () => {
    const { maps, scanned } = setup();

    await assert.rejects(maps.read('me/none'), NotFound);
    assert.equal(scanned.length, 0);
  });
});
