import { isLogSnapshot, parseLogsResponse } from './log-snapshot';
import { LOG_FIXTURE, LOG_FIXTURE_WITH_OLDER } from './testing/log-fixture';

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
    for (const clearedAt of ['2026-09-26T09:00:00Z', '2026-09-26', 'yesterday', '']) {
      expect(parseLogsResponse({ ...older, clearedAt }), clearedAt).toEqual(LOG_FIXTURE);
    }
  });

  it('keeps when the sky was cleared', () => {
    const cleared = { ...LOG_FIXTURE, clearedAt: '2026-09-26T09:00:00' };

    expect(parseLogsResponse(cleared)).toEqual(cleared);
  });

  it('reads the older faults, and a snapshot from before they were told apart as having none', () => {
    const before: Record<string, unknown> = { ...LOG_FIXTURE };
    delete before['older'];

    expect(parseLogsResponse(JSON.parse(JSON.stringify(LOG_FIXTURE_WITH_OLDER)))).toEqual(
      LOG_FIXTURE_WITH_OLDER,
    );
    expect(parseLogsResponse(before)).toEqual(LOG_FIXTURE);
    expect(parseLogsResponse({ ...before, older: 'many' })).toEqual(LOG_FIXTURE);
  });

  it('leaves out an older fault or window that does not parse', () => {
    const { older } = LOG_FIXTURE_WITH_OLDER;
    const parsed = parseLogsResponse({
      ...LOG_FIXTURE,
      older: {
        count: 3,
        faults: [{ id: 1, level: 'info' }, ...older.faults],
        windows: [{ error: 1 }, ...older.windows],
      },
    });

    expect(isLogSnapshot(parsed) && parsed.older).toEqual(older);
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
