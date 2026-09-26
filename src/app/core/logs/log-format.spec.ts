import { formatAt, formatCount, formatDay, windowName } from './log-format';

describe('log wording', () => {
  it('reads window ids, counts and days as pr-starmap does', () => {
    expect(windowName('ally_ult_tracker')).toBe('ally ult tracker');
    expect(formatCount(776900, 'en-US')).toBe('776,900');
    expect(formatDay('2026-06-21', 'en-US')).toBe('Jun 21');
    expect(formatDay('2026-09-26T23:59:00', 'en-US')).toBe('Sep 26');
    expect(formatAt('2026-09-23T01:43:37', 'en-US')).toBe('Sep 23, 01:43 AM');
  });
});
