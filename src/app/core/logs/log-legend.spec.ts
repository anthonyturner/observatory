import { layoutLogs } from './log-layout';
import { logLegend } from './log-legend';
import { logStamp } from './log-stamp';
import { LOG_FIXTURE, TEST_PALETTE } from './testing/log-fixture';

const layout = layoutLogs(LOG_FIXTURE, TEST_PALETTE);

describe('logLegend', () => {
  it('counts errors and warnings as the log does, and quiet windows as windows', () => {
    expect(logLegend(LOG_FIXTURE, layout)).toEqual([
      {
        key: 'error',
        count: 7,
        countText: '7',
        label: 'errors',
        colour: 'var(--log-error)',
        isLive: true,
      },
      {
        key: 'warn',
        count: 12,
        countText: '12',
        label: 'warnings',
        colour: 'var(--log-warn)',
        isLive: true,
      },
      {
        key: 'quiet',
        count: 1,
        countText: '1',
        label: 'quiet windows',
        colour: 'var(--log-quiet)',
        isLive: true,
      },
    ]);
  });

  it('greys every button while nothing is charted', () => {
    expect(logLegend(null, layoutLogs(null, TEST_PALETTE)).map((entry) => entry.isLive)).toEqual([
      false,
      false,
      false,
    ]);
  });
});

describe('logStamp', () => {
  it('names the folder, its lines, its span and what still burns', () => {
    const refreshed = new Date(LOG_FIXTURE.generatedAt).toLocaleString('en-US');

    expect(logStamp(LOG_FIXTURE, layout, 'en-US')).toBe(
      `Rivals Pulse · 1,500 lines · Sep 20 → Sep 26 · 3 still burning · refreshed ${refreshed}`,
    );
  });

  it('says so before any logs are read', () => {
    expect(logStamp(null, layoutLogs(null, TEST_PALETTE))).toBe('no logs yet');
  });
});
