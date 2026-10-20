import { LogFault, LogSnapshot, NO_OLDER } from '../log-snapshot';

/** A small log folder, folded, for the log sky's tests: a busy centre window,
 *  a fault shared by two windows, a warnings-only window, a quiet one, and one
 *  whose only fault fell past the chart's cap. */
export const LOG_FIXTURE: LogSnapshot = {
  generatedAt: '2026-09-26T10:00:00.000Z',
  source: 'Rivals Pulse',
  clearedAt: null,
  span: { from: '2026-09-20T08:00:00', to: '2026-09-26T09:30:00' },
  totals: { lines: 1500, files: 4, error: 7, warn: 12, info: 1481, faults: 4, omitted: 0 },
  windows: [
    window('desktop', { lines: 1000, error: 5, warn: 2, sessions: 3 }),
    window('ally_ult_tracker', { lines: 300, error: 2, warn: 0, sessions: 2 }),
    window('hero_lookup', { lines: 150, error: 0, warn: 10, sessions: 1 }),
    window('ban_list', { lines: 49, error: 0, warn: 0, sessions: 1 }),
    window('capped', { lines: 1, error: 0, warn: 1, sessions: 0 }),
  ],
  faults: [
    fault(1, 'desktop', 'error', {
      service: 'MatchApi',
      text: '[MatchApi] request failed with status #',
      count: 4,
      firstAt: '2026-09-20T08:00:00',
      lastAt: '2026-09-26T09:00:00',
      activeDays: 3,
    }),
    fault(2, 'ally_ult_tracker', 'error', {
      service: 'MatchApi',
      text: '[MatchApi] request failed with status #',
      count: 2,
      firstAt: '2026-09-21T08:00:00',
      lastAt: '2026-09-22T09:00:00',
      activeDays: 2,
    }),
    fault(3, 'desktop', 'error', {
      text: "Could not read 'hero' of undefined",
      count: 1,
      firstAt: '2026-09-23T08:00:00',
      lastAt: '2026-09-23T08:00:00',
      activeDays: 1,
    }),
    fault(4, 'hero_lookup', 'warn', {
      text: 'slow frame #ms',
      count: 10,
      firstAt: '2026-09-22T08:00:00',
      lastAt: '2026-09-26T09:00:00',
      activeDays: 4,
    }),
    fault(5, 'desktop', 'warn', {
      text: 'retrying',
      count: 2,
      firstAt: '2026-09-24T08:00:00',
      lastAt: '2026-09-24T09:00:00',
      activeDays: 1,
    }),
  ],
  older: NO_OLDER,
  timeline: [
    { day: '2026-09-20', error: 1, warn: 0, info: 100 },
    { day: '2026-09-22', error: 3, warn: 4, info: 500 },
    { day: '2026-09-26', error: 3, warn: 8, info: 881 },
  ],
};

/** A fault that stopped firing a day before the newest line, and so is kept out of the sky. */
export const OLDER_FAULT: LogFault = fault(6, 'hero_lookup', 'error', {
  text: 'old failure',
  count: 20,
  firstAt: '2026-09-20T08:00:00',
  lastAt: '2026-09-24T08:00:00',
  activeDays: 2,
});

/** The same folder with three faults set aside as older, one of them listed: 20 errors in
 *  `hero_lookup`, and 10 warnings in each of it and `desktop`. */
export const LOG_FIXTURE_WITH_OLDER: LogSnapshot = {
  ...LOG_FIXTURE,
  older: {
    count: 3,
    faults: [OLDER_FAULT],
    windows: [
      { id: 'hero_lookup', error: 20, warn: 10 },
      { id: 'desktop', error: 0, warn: 10 },
    ],
  },
};

function window(
  id: string,
  counts: { lines: number; error: number; warn: number; sessions: number },
): LogSnapshot['windows'][number] {
  return {
    id,
    ...counts,
    info: counts.lines - counts.error - counts.warn,
    firstAt: '2026-09-20T08:00:00',
    lastAt: '2026-09-26T09:30:00',
  };
}

function fault(
  id: number,
  window: string,
  level: LogFault['level'],
  rest: Omit<LogFault, 'id' | 'window' | 'level' | 'service'> & { service?: string },
): LogFault {
  return { id, window, level, service: rest.service ?? null, ...rest };
}

/** Plain colour names, so a test can tell the kinds apart. */
export const TEST_PALETTE = { error: 'red', warn: 'amber', quiet: 'green' } as const;
