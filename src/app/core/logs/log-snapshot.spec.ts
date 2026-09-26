import { isLogSnapshot, parseLogsResponse } from './log-snapshot';
import { LOG_FIXTURE } from './testing/log-fixture';

describe('parseLogsResponse', () => {
  it('reads a snapshot as the API sends it', () => {
    const parsed = parseLogsResponse(JSON.parse(JSON.stringify(LOG_FIXTURE)));

    expect(parsed).toEqual(LOG_FIXTURE);
    expect(isLogSnapshot(parsed)).toBe(true);
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
