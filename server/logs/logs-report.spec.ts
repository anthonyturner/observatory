import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, it } from 'node:test';
import { fsLogFolder } from './log-folder.ts';
import type { LogClears } from './log-clears.ts';
import type { LogsConfig } from './logs-config.ts';
import { logsReport, type LogSources } from './logs-report.ts';

const NOW = new Date('2026-09-26T10:00:00Z');
const sourcesOf = (folder: string | null, clearedAt: string | null = null): LogSources => ({
  config: { folderOf: () => folder, setFolder: () => undefined } satisfies LogsConfig,
  folder: fsLogFolder(),
  clears: {
    clearedAt: async () => clearedAt,
    clear: async () => undefined,
    reset: async () => undefined,
  } satisfies LogClears,
});

describe('logsReport', () => {
  it('says when no folder is recorded, or the recorded one is gone', async () => {
    assert.deepEqual(await logsReport(sourcesOf(null), 'me/app', NOW), {
      configured: false,
      reason: 'not-set',
    });
    assert.deepEqual(await logsReport(sourcesOf(join(tmpdir(), 'no-such-logs')), 'me/app', NOW), {
      configured: false,
      reason: 'not-found',
    });
  });

  it('reads every .log file in the folder, one window per rotated name', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'observatory-app-logs-'));
    writeFileSync(
      join(dir, 'desktop.html.1.log'),
      '2026-09-20 10:00:00,1 (ERROR) <a> (:1) - boom\r\n',
    );
    writeFileSync(join(dir, 'desktop.html.log'), '2026-09-21 10:00:00,1 (INFO) <a> (:1) - fine\n');
    writeFileSync(join(dir, 'notes.txt'), 'not a log');

    const report = await logsReport(sourcesOf(dir), 'me/app', NOW);

    assert.ok(!('configured' in report));
    assert.equal(report.generatedAt, NOW.toISOString());
    assert.equal(report.source, basename(dir));
    assert.equal(report.totals.files, 2);
    assert.deepEqual(
      report.windows.map((window) => [window.id, window.lines]),
      [['desktop', 2]],
    );
    assert.equal(report.faults[0]?.text, 'boom');
  });

  it('counts only what was logged after the repository’s clear, and leaves the files as they were', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'observatory-app-logs-'));
    const file = join(dir, 'desktop.html.log');
    const text = [
      '2026-09-20 10:00:00,1 (ERROR) <a> (:1) - old',
      '2026-09-22 10:00:00,1 (ERROR) <a> (:1) - new',
      '',
    ].join('\n');
    writeFileSync(file, text);
    utimesSync(file, 1_000_000, 1_000_000);

    const report = await logsReport(sourcesOf(dir, '2026-09-21T00:00:00'), 'me/app', NOW);

    assert.ok(!('configured' in report));
    assert.equal(report.clearedAt, '2026-09-21T00:00:00');
    assert.deepEqual(
      report.faults.map((fault) => fault.text),
      ['new'],
    );
    assert.equal(readFileSync(file, 'utf8'), text);
    assert.equal(statSync(file).mtimeMs, 1_000_000_000);
  });
});
