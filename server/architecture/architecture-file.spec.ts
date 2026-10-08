import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { NotFound } from '../http/api-handler.ts';
import { fileArchitecture, writeArchitecture } from './architecture-file.ts';
import { SAMPLE_MAP } from './sample-map.ts';

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
    await writeArchitecture(SAMPLE_MAP, file);
    assert.deepEqual(await fileArchitecture(file)(), SAMPLE_MAP);
  });

  it('throws NotFound when no map has been written', async () => {
    await assert.rejects(fileArchitecture(join(dir, 'map.json'))(), NotFound);
  });
});
