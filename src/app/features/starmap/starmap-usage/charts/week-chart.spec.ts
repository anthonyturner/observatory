import { LimitWindow } from '../../../../core/usage/usage-document';
import { weekChart } from './week-chart';

const HOUR = 3_600_000;
const START = new Date(2026, 8, 25, 15, 0).getTime();
const RESET = START + 168 * HOUR;
const WIDTH = 452;

const week = (more: Partial<LimitWindow> = {}): LimitWindow => ({
  pct: 20,
  resetsAt: new Date(RESET).toISOString(),
  startsAt: new Date(START).toISOString(),
  points: [
    [START + 24 * HOUR, 10],
    [START + 48 * HOUR, 20],
  ],
  ...more,
});

describe('weekChart', () => {
  it('lays the readings out over the seven days of the week', () => {
    const chart = weekChart({
      week: week(),
      width: WIDTH,
      now: START + 60 * HOUR,
      locale: 'en-US',
    });

    // 400px of plot for 168 hours, and 154px for 100%.
    expect(chart.line).toBe('M97.1,150.6L154.3,135.2');
    expect(chart.dot?.x).toBeCloseTo(40 + (400 * 2) / 7);
    expect(chart.dot?.y).toBeCloseTo(135.2);
    expect(chart.area).toBe('M97.1,150.6L154.3,135.2L154.3,166L97.1,166Z');
    expect(chart.axis.filter((text) => text.anchor === 'middle').map((text) => text.text)).toEqual(
      // Each day is named at its middle: the week starts at 3 PM on a Friday.
      ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    );
    expect(chart.axis.filter((text) => text.anchor === 'end').map((text) => text.text)).toEqual([
      '0%',
      '25%',
      '50%',
      '75%',
      '100%',
    ]);
  });

  it('marks now, and gives each reading a tooltip', () => {
    const chart = weekChart({
      week: week(),
      width: WIDTH,
      now: START + 60 * HOUR,
      locale: 'en-US',
    });

    expect(chart.now?.label.text).toBe('now');
    expect(chart.hits.map((hit) => hit.tip)).toEqual([
      'Sat 3:00 PM\n10% of the week used',
      'Sun 3:00 PM\n20% of the week used',
    ]);
  });

  it('dashes the pace on to the reset, or to 100% in amber when it runs out first', () => {
    const toReset = weekChart({
      week: week({ projection: { atReset: 60 } }),
      width: WIDTH,
      now: START,
    });
    const runsOut = weekChart({
      week: week({
        projection: { atReset: 140, fullAt: new Date(RESET - 24 * HOUR).toISOString() },
      }),
      width: WIDTH,
      now: START,
    });

    expect(toReset.projection?.isOver).toBe(false);
    expect(toReset.projection?.path).toMatch(/^M154\.28\d*,135\.2\d*L440,73\.6\d*$/);
    expect(runsOut.projection?.isOver).toBe(true);
    expect(runsOut.projection?.path).toMatch(/L382\.85\d*,12$/);
  });

  it('draws only the frame when nothing has been read, and no now outside the week', () => {
    const chart = weekChart({ week: week({ points: [] }), width: WIDTH, now: RESET + HOUR });

    expect(chart.line).toBeNull();
    expect(chart.hits).toEqual([]);
    expect(chart.now).toBeNull();
  });
});
