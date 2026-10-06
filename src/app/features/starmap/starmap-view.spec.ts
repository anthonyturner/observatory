import { SkyItem } from './engine/sky-model';
import { chartOf, fragmentOf, isListOnly, queueChips, queueStamp, titleOf } from './starmap-view';

const item = (pr: number, bucket: SkyItem['bucket'], additions: number | null): SkyItem => ({
  pr,
  title: String(pr),
  bucket,
  idleDays: 1,
  additions,
  deletions: 0,
  issues: [],
});

describe('chartOf', () => {
  it('reads the screen from the address fragment, as pr-starmap read its hash', () => {
    expect(chartOf(null)).toBe('prs');
    expect(chartOf('logs')).toBe('logs');
    expect(chartOf('issues/closed')).toBe('issues');
    expect(chartOf('usage')).toBe('usage');
    expect(chartOf('retro')).toBe('retro');
    expect(fragmentOf('prs')).toBeUndefined();
    expect(fragmentOf('logs')).toBe('logs');
  });

  it('titles each screen and knows which have no sky', () => {
    expect(['prs', 'logs', 'issues', 'usage', 'retro'].map((c) => titleOf(chartOf(c)))).toEqual([
      'Review Queue',
      'Log Sky',
      'Issues',
      'Usage',
      'Weekly retro',
    ]);
    expect(isListOnly('usage')).toBe(true);
    expect(isListOnly('retro')).toBe(true);
    expect(isListOnly('prs')).toBe(false);
  });
});

describe('queueChips', () => {
  it('counts every bucket, empty ones faint, then the quick wins', () => {
    const chips = queueChips([item(1, 'conflicted', 900), item(2, 'unreviewed', 20)]);

    expect(chips.map((c) => [c.id, c.count, c.live, c.text])).toEqual([
      ['conflicted', 1, true, 'cannot merge'],
      ['failing', 0, false, 'checks failing'],
      ['unknown', 0, false, 'mergeability unknown'],
      ['unlinked', 0, false, 'no issue linked'],
      ['unreviewed', 1, true, 'waiting on you'],
      ['fresh', 0, false, 'seen recently'],
      ['quick', 1, true, 'quick wins'],
    ]);
  });
});

describe('queueStamp', () => {
  it('names the repository, what is open and when it was read', () => {
    const at = '2026-09-26T08:46:49Z';
    expect(queueStamp('me/a', 18, at, 'en-US')).toBe(
      `me/a · 18 open · refreshed ${new Date(at).toLocaleString('en-US')}`,
    );
    expect(queueStamp('me/a', 0, null)).toBe('no data yet');
  });
});
