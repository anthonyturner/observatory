import { formatAt } from './log-format';
import { layoutLogs } from './log-layout';
import { logListSections } from './log-list';
import { LOG_FIXTURE, TEST_PALETTE } from './testing/log-fixture';

const layout = layoutLogs(LOG_FIXTURE, TEST_PALETTE);

describe('logListSections', () => {
  it('groups every fault under its window, worst window first', () => {
    const sections = logListSections(layout, null, 'en-US');

    expect(sections.map((section) => [section.label, section.sub, section.rows.length])).toEqual([
      ['desktop', '5 errors · 2 warnings · 1,000 lines', 3],
      ['ally ult tracker', '2 errors · 0 warnings · 300 lines', 1],
      ['hero lookup', '0 errors · 10 warnings · 150 lines', 1],
    ]);
    const [first] = sections[0].rows;
    expect([first.count, first.text, first.info, first.colour]).toEqual([
      '×4',
      '[MatchApi] request failed with status #',
      `error · last ${formatAt('2026-09-26T09:00:00', 'en-US')} · burning`,
      'var(--log-error)',
    ]);
    expect(sections[0].colour).toBe('var(--log-error)');
  });

  it('lists only the filtered level, and drops windows left empty', () => {
    const sections = logListSections(layout, 'warn', 'en-US');

    expect(sections.map((section) => section.label)).toEqual(['desktop', 'hero lookup']);
    expect(sections[0].rows[0].info).toContain('warning · last');
    expect(logListSections(layout, 'quiet')).toEqual([]);
  });
});
