import { isLogSnapshot, parseLogsResponse } from './log-snapshot';
import { LOG_FIXTURE } from './testing/log-fixture';

describe('parseLogsResponse', () => {
  it('reads a snapshot as the API sends it', () => {
    const parsed = parseLogsResponse(JSON.parse(JSON.stringify(LOG_FIXTURE)));

    expect(parsed).toEqual(LOG_FIXTURE);
    expect(isLogSnapshot(parsed)).toBe(true);
  });

  it('reads a snapshot from before the sky could be cleared as not cleared', () => {
    const older: Record<string, unknown> = { ...LOG_FIXTURE };
    delete older['clearedAt'];

    expect(parseLogsResponse(older)).toEqual(LOG_FIXTURE);
    expect(parseLogsResponse({ ...older, clearedAt: 7 })).toEqual(LOG_FIXTURE);
  });

  it('keeps when the sky was cleared', () => {
    const cleared = { ...LOG_FIXTURE, clearedAt: '2026-09-26T09:00:00' };

    expect(parseLogsResponse(cleared)).toEqual(cleared);
  });

  it('says why there is no snapshot', () => {
    expect(parseLogsResponse({ configured: false, reason: 'not-found' })).toEqual({
      configured: false,
      reason: 'not-found',
    });
    expect(parseLogsResponse({ configured: false })).toEqual({
      configured: false,
      reason: 'not-set',
    });
  });

  it('leaves out what does not parse, and refuses what is not a snapshot', () => {
    const parsed = parseLogsResponse({
      ...LOG_FIXTURE,
      faults: [{ id: 1, level: 'info', window: 'desktop', text: 'x' }, ...LOG_FIXTURE.faults],
      windows: [{ lines: 3 }, ...LOG_FIXTURE.windows],
    });

    expect(isLogSnapshot(parsed) && parsed.faults.length).toBe(LOG_FIXTURE.faults.length);
    expect(isLogSnapshot(parsed) && parsed.windows.length).toBe(LOG_FIXTURE.windows.length);
    expect(parseLogsResponse('nope')).toBeNull();
    expect(parseLogsResponse({ source: 'x' })).toBeNull();
  });
});
