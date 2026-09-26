import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { localSetting } from './local-setting.ts';

const folder = mkdtempSync(join(tmpdir(), 'observatory-setting-'));
const file = join(folder, '.env');
const missing = join(folder, 'missing.env');
writeFileSync(file, 'SOME_KEY=from-file\n');

describe('localSetting', () => {
  it('takes the environment first, then the file, else none', () => {
    assert.equal(localSetting('SOME_KEY', { SOME_KEY: 'from-env' }, file), 'from-env');
    assert.equal(localSetting('SOME_KEY', {}, file), 'from-file');
    assert.equal(localSetting('SOME_KEY', {}, missing), null);
  });

  it('reads an empty value as none', () => {
    assert.equal(localSetting('SOME_KEY', { SOME_KEY: '' }, missing), null);
  });
});
