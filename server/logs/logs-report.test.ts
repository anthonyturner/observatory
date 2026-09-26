import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, it } from 'node:test';
import { fsLogFolder } from './log-folder.ts';
import type { LogsConfig } from './logs-config.ts';
import { logsReport } from './logs-report.ts';

const NOW = new Date('2026-09-26T10:00:00Z');
const configOf = (folder: string | null): LogsConfig => ({
  folderOf: () => folder,
  setFolder: () => undefined,
});

describe('logsReport', () => {
  it('says when no folder is recorded, or the recorded one is gone', async () => {
    assert.deepEqual(await logsReport(configOf(null), fsLogFolder(), 'me/app', NOW), {
      configured: false,
      reason: 'not-set',
    });
    assert.deepEqual(
      await logsReport(configOf(join(tmpdir(), 'no-such-logs')), fsLogFolder(), 'me/app', NOW),
      { configured: false, reason: 'not-found' },
    );
  });

  it('reads every .log file in the folder, one window per rotated name', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'observatory-app-logs-'));
    writeFileSync(
      join(dir, 'desktop.html.1.log'),
      '2026-09-20 10:00:00,1 (ERROR) <a> (:1) - boom\r\n',
    );
    writeFileSync(join(dir, 'desktop.html.log'), '2026-09-21 10:00:00,1 (INFO) <a> (:1) - fine\n');
    writeFileSync(join(dir, 'notes.txt'), 'not a log');

    const report = await logsReport(configOf(dir), fsLogFolder(), 'me/app', NOW);

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
});
