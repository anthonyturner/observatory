import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { record, sampleOf } from './limit-recorder.ts';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const status = (weekPct: number) => ({
  rate_limits: {
    seven_day: { used_percentage: weekPct, resets_at: 1_791_000_000 },
    five_hour: { used_percentage: '12.34', resets_at: '2026-09-26T15:00:00Z' },
  },
});

function tempFiles() {
  const dir = mkdtempSync(join(tmpdir(), 'observatory-recorder-'));
  return { samples: join(dir, 'samples.jsonl'), last: join(dir, 'last.json') };
}

const lines = (file: string) => readFileSync(file, 'utf8').trim().split('\n');

describe('sampleOf', () => {
  it('reads both windows, in epoch seconds or as a date', () => {
    assert.deepEqual(sampleOf(status(5), NOW), {
      at: '2026-09-26T12:00:00.000Z',
      week: { pct: 5, resetsAt: new Date(1_791_000_000_000).toISOString() },
      five: { pct: 12.3, resetsAt: '2026-09-26T15:00:00.000Z' },
    });
  });

  it('keeps a missing figure missing, never zero', () => {
    const sample = sampleOf(
      { rate_limits: { seven_day: { used_percentage: null, resets_at: 1 } } },
      NOW,
    );
    assert.equal(sample, null);
  });
});

describe('record', () => {
  it('keeps a reading only when it changed or the heartbeat is due', () => {
    const files = tempFiles();

    assert.equal(record(status(5), NOW, files), true);
    assert.equal(record(status(5), NOW + 60_000, files), false);
    assert.equal(record(status(6), NOW + 120_000, files), true);
    assert.equal(record(status(6), NOW + 11 * 60_000, files), false);
    assert.equal(record(status(6), NOW + 12 * 60_000, files), true);

    assert.equal(lines(files.samples).length, 3);
  });

  it('ignores a status without limits and never throws', () => {
    const files = tempFiles();

    assert.equal(record({ model: 'x' }, NOW, files), false);
    assert.equal(record('not json', NOW, files), false);
  });
});
