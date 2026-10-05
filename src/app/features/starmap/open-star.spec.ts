import { Comet } from './comets';
import { ringedComet, ringedPull } from './open-star';

const comet = (issue: number): Comet => ({
  issue,
  title: `Issue ${issue}`,
  url: `https://github.com/me/a/issues/${issue}`,
  labels: [],
  ageDays: 1,
  idleDays: 1,
});

describe('ringedPull', () => {
  const pulls = [
    { number: 10, closes: [3] },
    { number: 11, closes: [4, 5] },
  ];

  it('rings the open screen over the card', () => {
    expect(ringedPull({ card: 10, sheet: 11, issue: null }, pulls)).toBe(11);
  });

  it('rings the pull request that closes the open issue', () => {
    expect(ringedPull({ card: 10, sheet: null, issue: 5 }, pulls)).toBe(11);
  });

  it('keeps the card’s pull request when it also closes the open issue', () => {
    const both = [...pulls, { number: 12, closes: [5] }];
    expect(ringedPull({ card: 12, sheet: null, issue: 5 }, both)).toBe(12);
  });

  it('falls back to the card when nothing closes the open issue', () => {
    expect(ringedPull({ card: 10, sheet: null, issue: 9 }, pulls)).toBe(10);
  });

  it('rings nothing when nothing is open', () => {
    expect(ringedPull({ card: null, sheet: null, issue: null }, pulls)).toBeNull();
  });
});

describe('ringedComet', () => {
  const comets = [comet(3), comet(4)];

  it('rings the open issue’s comet over the picked one', () => {
    expect(ringedComet(4, comets, comets[0])).toBe(comets[1]);
  });

  it('keeps the picked comet when the open issue has none', () => {
    expect(ringedComet(9, comets, comets[0])).toBe(comets[0]);
    expect(ringedComet(null, comets, null)).toBeNull();
  });
});
