import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileLogsConfig } from './logs-config.ts';

const fileIn = () => join(mkdtempSync(join(tmpdir(), 'observatory-logs-config-')), 'logs.json');

describe('fileLogsConfig', () => {
  it('reads a missing or broken file as no folder', () => {
    const file = fileIn();
    assert.equal(fileLogsConfig(file).folderOf('me/app'), null);
    writeFileSync(file, '{not json');
    assert.equal(fileLogsConfig(file).folderOf('me/app'), null);
  });

  it('records a folder and keeps every other repository’s', () => {
    const file = fileIn();
    writeFileSync(file, JSON.stringify({ 'me/other': 'D:\\logs', 'me/odd': 7 }));

    fileLogsConfig(file).setFolder('me/app', 'C:\\Logs\\App');

    assert.equal(fileLogsConfig(file).folderOf('me/app'), 'C:\\Logs\\App');
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), {
      'me/other': 'D:\\logs',
      'me/app': 'C:\\Logs\\App',
    });
  });
});
