import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { writeArchitecture } from './architecture-file.ts';
import { SAMPLE_MAP } from './sample-map.ts';

describe('architecture file', () => {
  let dir = '';

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'architecture-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes the map as JSON, creating missing folders', async () => {
    const file = join(dir, 'nested', 'map.json');
    await writeArchitecture(SAMPLE_MAP, file);
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), SAMPLE_MAP);
  });
});
