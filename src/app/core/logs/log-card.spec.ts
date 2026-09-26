import { findInCodeUrl, logCardView } from './log-card';
import { formatAt } from './log-format';
import { layoutLogs } from './log-layout';
import { LOG_FIXTURE, TEST_PALETTE } from './testing/log-fixture';

const { stars } = layoutLogs(LOG_FIXTURE, TEST_PALETTE);
const at = (iso: string) => formatAt(iso, 'en-US');

describe('logCardView', () => {
  it('shows a fault’s message, when it fired and where else', () => {
    const view = logCardView(stars[0], LOG_FIXTURE, 'me/app', 'en-US');

    expect(view).toEqual({
      colour: 'var(--log-error)',
      kicker: 'Error — desktop',
      title: '×4',
      heading: null,
      excerpt: '[MatchApi] request failed with status #',
      facts: [
        { term: 'service', value: 'MatchApi', isHot: false },
        { term: 'active', value: '3 days', isHot: false },
        { term: 'first', value: at('2026-09-20T08:00:00'), isHot: false },
        { term: 'last', value: `${at('2026-09-26T09:00:00')} · still burning`, isHot: true },
        { term: 'also in', value: 'ally ult tracker ×2', isHot: false },
      ],
      message: '[MatchApi] request failed with status #',
      findUrl: `https://github.com/search?type=code&q=${encodeURIComponent(
        'repo:me/app "[MatchApi] request failed with status"',
      )}`,
    });
  });

  it('says a one-off fault lives in this window only, and has no service', () => {
    const view = logCardView(stars[1], LOG_FIXTURE, null, 'en-US');

    expect(view?.facts.map((fact) => fact.term)).toEqual(['active', 'first', 'last', 'also in']);
    expect(view?.facts[0].value).toBe('1 day');
    expect(view?.facts[3].value).toBe('this window only');
    expect(view?.findUrl).toBeNull();
  });

  it('gives a quiet window its lines and sessions, and nothing to copy', () => {
    const view = logCardView(stars[5], LOG_FIXTURE, 'me/app', 'en-US');

    expect(view).toEqual({
      colour: 'var(--log-quiet)',
      kicker: 'Quiet window',
      title: 'ban list',
      heading: 'No errors or warnings in 49 lines.',
      excerpt: null,
      facts: [
        { term: 'sessions', value: '1', isHot: false },
        { term: 'first', value: at('2026-09-20T08:00:00'), isHot: false },
        { term: 'last', value: at('2026-09-26T09:30:00'), isHot: false },
      ],
      message: null,
      findUrl: null,
    });
  });
});

describe('findInCodeUrl', () => {
  it('searches for the longest literal run, cut at 80 characters', () => {
    const url = findInCodeUrl(`id # ${'a'.repeat(100)} {…}`, 'me/app');
    expect(decodeURIComponent(url ?? '')).toBe(
      `https://github.com/search?type=code&q=repo:me/app "${'a'.repeat(80)}"`,
    );
  });

  it('does not search for a phrase too short to find', () => {
    expect(findInCodeUrl('tick #ms', 'me/app')).toBeNull();
    expect(findInCodeUrl('retrying', 'me/app')).toBeNull();
  });
});
