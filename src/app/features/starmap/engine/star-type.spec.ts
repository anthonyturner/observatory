import { SkyItem } from './sky-model';
import { starLook } from './star-type';

const pr = (bucket: SkyItem['bucket'], idleDays: number): { item: SkyItem } => ({
  item: { pr: 1, title: '', bucket, idleDays, additions: 1, deletions: 1, issues: [] },
});

describe('starLook', () => {
  it('makes blocked pull requests giants that flare more the longer they sit', () => {
    expect(starLook(pr('conflicted', 0))).toEqual({ type: 'giant', activity: 0.25 });
    expect(starLook(pr('failing', 7)).activity).toBeCloseTo(0.625);
    expect(starLook(pr('failing', 40)).activity).toBe(1);
  });

  it('veils an unsettled merge, burns waiting work clear and rests what was seen', () => {
    expect(starLook(pr('unknown', 3)).type).toBe('veiled');
    expect(starLook(pr('unreviewed', 3))).toEqual({ type: 'bright', activity: 0 });
    expect(starLook(pr('unlinked', 3)).type).toBe('bright');
    expect(starLook(pr('fresh', 3)).type).toBe('calm');
  });

  it('draws a star that stands for no pull request as a still, bright one', () => {
    expect(starLook({ item: undefined })).toEqual({ type: 'bright', activity: 0 });
  });
});
