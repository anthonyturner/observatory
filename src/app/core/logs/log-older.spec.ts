import { withOlder } from './log-older';
import { LogSnapshot } from './log-snapshot';
import { LOG_FIXTURE, LOG_FIXTURE_WITH_OLDER, OLDER_FAULT } from './testing/log-fixture';

describe('withOlder', () => {
  it('is the same snapshot when nothing is older', () => {
    expect(withOlder(LOG_FIXTURE)).toBe(LOG_FIXTURE);
  });

  it('ranks the older faults after the current ones', () => {
    const shown = withOlder(LOG_FIXTURE_WITH_OLDER);

    expect(shown.faults.map((fault) => fault.id)).toEqual([
      ...LOG_FIXTURE.faults.map((f) => f.id),
      OLDER_FAULT.id,
    ]);
  });

  it('adds their occurrences back to the window and the totals, and the older faults past the list', () => {
    const shown = withOlder(LOG_FIXTURE_WITH_OLDER);
    const hero = (snapshot: LogSnapshot) => snapshot.windows.find((w) => w.id === 'hero_lookup');

    expect(hero(shown)).toEqual({
      ...hero(LOG_FIXTURE_WITH_OLDER),
      lines: 150 + 30,
      error: 20,
      warn: 20,
    });
    expect(shown.totals).toEqual({
      ...LOG_FIXTURE.totals,
      lines: LOG_FIXTURE.totals.lines + 40,
      error: LOG_FIXTURE.totals.error + 20,
      warn: LOG_FIXTURE.totals.warn + 20,
      faults: LOG_FIXTURE.totals.faults + 3,
      omitted: 2,
    });
  });

  it('puts the worst window first again', () => {
    const shown = withOlder(LOG_FIXTURE_WITH_OLDER);

    expect(shown.windows[0].id).toBe('hero_lookup');
  });

  it('leaves nothing older over', () => {
    expect(withOlder(LOG_FIXTURE_WITH_OLDER).older).toEqual({ count: 0, faults: [], windows: [] });
  });
});
