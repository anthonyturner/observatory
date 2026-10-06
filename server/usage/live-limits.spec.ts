import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sampleOf } from './limit-recorder.ts';
import { readLiveLimits, statusOf, throttledLiveLimits } from './live-limits.ts';

const NOW = Date.parse('2026-09-30T10:00:00Z');
const REPLY = {
  five_hour: { utilization: 13.0, resets_at: '2026-09-30T14:09:59.576010+00:00' },
  seven_day: { utilization: 56.0, resets_at: '2026-10-02T18:59:59.576030+00:00' },
  seven_day_opus: null,
};

describe('statusOf', () => {
  it('turns the usage reply into readings the recorder keeps', () => {
    assert.deepEqual(sampleOf(statusOf(REPLY), NOW), {
      at: '2026-09-30T10:00:00.000Z',
      week: { pct: 56, resetsAt: '2026-10-02T18:59:59.576Z' },
      five: { pct: 13, resetsAt: '2026-09-30T14:09:59.576Z' },
    });
  });

  it('leaves a window the reply lacks missing', () => {
    assert.equal(sampleOf(statusOf({ five_hour: null, seven_day: null }), NOW), null);
    assert.equal(sampleOf(statusOf(null), NOW), null);
  });
});

describe('readLiveLimits', () => {
  it('asks nothing without a sign-in', async () => {
    let asked = false;
    const fetch = async () => {
      asked = true;
      return new Response('{}');
    };

    assert.equal(await readLiveLimits({ token: () => null, fetch }, NOW), false);
    assert.equal(asked, false);
  });

  it('treats a refused or broken reply as no reading', async () => {
    const refused = async () => new Response('no', { status: 401 });
    const offline = async (): Promise<Response> => {
      throw new Error('offline');
    };

    assert.equal(await readLiveLimits({ token: () => 't', fetch: refused }, NOW), false);
    assert.equal(await readLiveLimits({ token: () => 't', fetch: offline }, NOW), false);
  });
});

describe('throttledLiveLimits', () => {
  it('reads at most once per gap, and once for callers that overlap', async () => {
    let reads = 0;
    const read = throttledLiveLimits(async () => reads++, 60_000);

    await Promise.all([read(NOW), read(NOW)]);
    await read(NOW + 30_000);
    await read(NOW + 61_000);

    assert.equal(reads, 2);
  });

  it('survives a read that fails', async () => {
    const read = throttledLiveLimits(() => Promise.reject(new Error('x')), 0);

    await assert.doesNotReject(read(NOW));
  });
});
