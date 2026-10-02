import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { localMailLogin } from './mail-settings.ts';

const folder = mkdtempSync(join(tmpdir(), 'observatory-mail-'));
const file = join(folder, '.env');
const missing = join(folder, 'missing.env');
writeFileSync(
  file,
  'ICLOUD_MAIL_ADDRESS=me@icloud.example\nICLOUD_MAIL_APP_PASSWORD=from-file\nGMAIL_ADDRESS=me@gmail.example\n',
);

describe('localMailLogin', () => {
  it('takes each setting from the environment first, then the file', () => {
    assert.deepEqual(localMailLogin('icloud', { ICLOUD_MAIL_APP_PASSWORD: 'from-env' }, file), {
      address: 'me@icloud.example',
      password: 'from-env',
    });
  });

  it('strips the spaces Google shows an app password with', () => {
    assert.equal(
      localMailLogin('gmail', { GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' }, file)?.password,
      'abcdefghijklmnop',
    );
  });

  it('is off unless both the address and the password are set', () => {
    assert.equal(localMailLogin('gmail', {}, file), null);
    assert.equal(localMailLogin('icloud', {}, missing), null);
    assert.equal(localMailLogin('gmail', { GMAIL_APP_PASSWORD: '   ' }, file), null);
  });
});
