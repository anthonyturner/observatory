import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { localKey } from './open-router-key.ts';

const folder = mkdtempSync(join(tmpdir(), 'observatory-env-'));
const file = join(folder, '.env');
writeFileSync(file, 'export OPENROUTER_API_KEY="from-file"\n');

describe('localKey', () => {
  it('takes the environment first, then the file, else none', () => {
    assert.equal(localKey({ OPENROUTER_API_KEY: 'from-env' }, file), 'from-env');
    assert.equal(localKey({}, file), 'from-file');
    assert.equal(localKey({}, join(folder, 'missing.env')), null);
  });
});
