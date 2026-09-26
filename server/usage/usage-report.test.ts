import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { REPORT_DAYS, usageReport } from './usage-report.ts';

const NOW = new Date(2026, 8, 26, 12, 0).getTime();

describe('usageReport', () => {
  it('puts the limits and a month of tokens together', async () => {
    const root = mkdtempSync(join(tmpdir(), 'observatory-report-'));
    const logsDir = join(root, 'projects');
    mkdirSync(join(logsDir, 'p'), { recursive: true });
    writeFileSync(
      join(logsDir, 'p', 's.jsonl'),
      JSON.stringify({
        type: 'assistant',
        timestamp: new Date(NOW - 60_000).toISOString(),
        message: { id: 'm', model: 'claude-opus-5', usage: { input_tokens: 1, output_tokens: 2 } },
      }),
    );
    const samplesFile = join(root, 'samples.jsonl');
    writeFileSync(
      samplesFile,
      JSON.stringify({
        at: new Date(NOW).toISOString(),
        week: { pct: 5, resetsAt: new Date(NOW + 86_400_000).toISOString() },
        five: null,
      }),
    );

    const report = await usageReport(
      { logsDir, samplesFile, cacheFile: join(root, 'cache.json') },
      NOW,
    );

    assert.equal(report.tokens.rows.length, REPORT_DAYS);
    assert.deepEqual(report.tokens.rows.at(-1)?.families, { opus: 3 });
    assert.equal(report.limits?.week?.pct, 5);
    assert.equal(report.limits?.five, null);
  });

  it('reports no limits and empty days when nothing has been recorded', async () => {
    const root = mkdtempSync(join(tmpdir(), 'observatory-empty-'));

    const report = await usageReport(
      {
        logsDir: join(root, 'none'),
        samplesFile: join(root, 'none.jsonl'),
        cacheFile: join(root, 'cache.json'),
      },
      NOW,
    );

    assert.equal(report.limits, null);
    assert.ok(report.tokens.rows.every((row) => Object.keys(row.families).length === 0));
  });
});
