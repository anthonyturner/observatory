import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { NotFound } from '../http/api-handler.ts';
import { fileArchitecture, writeArchitecture } from './architecture-file.ts';
import type { ArchitectureMap } from './architecture-types.ts';

const MAP: ArchitectureMap = {
  project: 'clockwork',
  scannedAt: '2026-10-01T00:00:00Z',
  areas: [{ id: 'core', label: 'Core' }],
  windows: ['desktop'],
  nodes: [
    {
      name: 'ClockService',
      kind: 'service',
      file: 'core/clock.ts',
      area: 'core',
      group: '',
      providedIn: 'root',
    },
  ],
  edges: [],
};

describe('architecture file', () => {
  let dir = '';

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'architecture-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads back the map it wrote, creating missing folders', async () => {
    const file = join(dir, 'nested', 'map.json');
    await writeArchitecture(MAP, file);
    assert.deepEqual(await fileArchitecture(file)(), MAP);
  });

  it('throws NotFound when no map has been written', async () => {
    await assert.rejects(fileArchitecture(join(dir, 'map.json'))(), NotFound);
  });
});
