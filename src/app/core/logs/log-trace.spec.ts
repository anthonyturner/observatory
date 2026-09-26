import { layoutLogs } from './log-layout';
import { sameFaultStar, traceOnPick, twinStars } from './log-trace';
import { LOG_FIXTURE, TEST_PALETTE } from './testing/log-fixture';

const { stars } = layoutLogs(LOG_FIXTURE, TEST_PALETTE);

describe('traceOnPick', () => {
  it('traces a fault, and clears for a quiet window or empty sky', () => {
    expect(traceOnPick(stars[0])).toBe(stars[0]);
    expect(traceOnPick(stars[5])).toBeNull();
    expect(traceOnPick(null)).toBeNull();
  });
});

describe('twinStars', () => {
  it('finds the same fault in every other window', () => {
    expect(twinStars(stars[0], stars)).toEqual([stars[3]]);
    expect(twinStars(stars[1], stars)).toEqual([]);
    expect(twinStars(null, stars)).toEqual([]);
  });
});

describe('sameFaultStar', () => {
  it('finds a fault again after the sky is laid out anew', () => {
    const again = layoutLogs(LOG_FIXTURE, TEST_PALETTE).stars;
    const [first] = LOG_FIXTURE.faults;
    expect(sameFaultStar({ ...first, id: 99, count: 50 }, again)).toBe(again[0]);
    expect(sameFaultStar({ ...first, window: 'gone' }, again)).toBeNull();
  });
});
