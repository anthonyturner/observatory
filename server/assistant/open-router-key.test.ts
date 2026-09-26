import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { envFile, localKey } from './open-router-key.ts';

const folder = mkdtempSync(join(tmpdir(), 'observatory-env-'));
const file = join(folder, '.env');
const missing = join(folder, 'missing.env');
writeFileSync(
  file,
  [
    '# a comment',
    'export OPENROUTER_API_KEY="from-file"',
    "QUOTED='kept # as is'",
    'PLAIN=value # a trailing comment',
    'not a line',
  ].join('\r\n'),
);

describe('envFile', () => {
  it('reads NAME=value lines, quoted or not, dropping trailing comments', () => {
    assert.deepEqual(envFile(file), {
      OPENROUTER_API_KEY: 'from-file',
      QUOTED: 'kept # as is',
      PLAIN: 'value',
    });
  });

  it('reads none when there is no file', () => {
    assert.deepEqual(envFile(missing), {});
  });
});

describe('localKey', () => {
  it('takes the environment first, then the file, else none', () => {
    assert.equal(localKey({ OPENROUTER_API_KEY: 'from-env' }, file), 'from-env');
    assert.equal(localKey({}, file), 'from-file');
    assert.equal(localKey({}, missing), null);
  });
});
