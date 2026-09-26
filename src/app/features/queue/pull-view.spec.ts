import { CheckLine } from '../../core/queue/pull-detail';
import { checkTally, checksToName, shortDate } from './pull-view';

const check = (outcome: CheckLine['outcome'], name = outcome): CheckLine => ({
  name,
  outcome,
  url: null,
});

describe('checkTally', () => {
  it('counts each outcome, failures first, leaving out the empty ones', () => {
    expect(checkTally([check('passed'), check('passed'), check('failed'), check('pending')])).toBe(
      '1 failed · 1 pending · 2 passed',
    );
  });

  it('says when there are no checks at all', () => {
    expect(checkTally([])).toBe('no checks');
  });
});

describe('checksToName', () => {
  it('names only the checks that failed or have not finished', () => {
    expect(
      checksToName([check('passed'), check('failed'), check('skipped'), check('pending')]).map(
        (c) => c.outcome,
      ),
    ).toEqual(['failed', 'pending']);
  });
});

describe('shortDate', () => {
  const now = new Date(2026, 8, 26).getTime();

  it('leaves the year out for this year, and in for another', () => {
    expect(shortDate('2026-07-30T05:16:37Z', now, 'en-US')).toBe('Jul 30');
    expect(shortDate('2025-07-30T05:16:37Z', now, 'en-US')).toBe('Jul 30, 2025');
  });
});
