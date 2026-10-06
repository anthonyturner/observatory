import assert from 'node:assert/strict';
import { delimiter, join } from 'node:path';
import { describe, it } from 'node:test';
import { findClaude } from './claude-command.ts';

const BIN = join('C:', 'bin');
const NPM = join('C:', 'npm');

const search = (platform: NodeJS.Platform, files: readonly string[], pathKey = 'PATH') => ({
  env: { [pathKey]: [BIN, NPM].join(delimiter) },
  platform,
  exists: (file: string) => files.includes(file),
});

describe('findClaude', () => {
  it('on Windows, takes a batch shim and says so, skipping the extensionless script', () => {
    const files = [join(BIN, 'claude'), join(NPM, 'claude.cmd')];

    assert.deepEqual(findClaude(search('win32', files, 'Path')), {
      file: join(NPM, 'claude.cmd'),
      isShim: true,
    });
  });

  it('on Windows, prefers a real executable in the same folder', () => {
    const files = [join(NPM, 'claude.exe'), join(NPM, 'claude.cmd')];

    assert.deepEqual(findClaude(search('win32', files)), {
      file: join(NPM, 'claude.exe'),
      isShim: false,
    });
  });

  it('elsewhere, takes plain `claude`', () => {
    assert.deepEqual(findClaude(search('linux', [join(BIN, 'claude')])), {
      file: join(BIN, 'claude'),
      isShim: false,
    });
  });

  it('is null when there is none on the PATH', () => {
    assert.equal(findClaude(search('win32', [])), null);
  });
});
