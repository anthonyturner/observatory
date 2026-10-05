import { findOnSky, searchSuggestions } from './sky-search';

describe('findOnSky', () => {
  const pulls = [
    { number: 12, title: 'Add the search box', closes: [7] },
    { number: 15, title: 'Fix the orrery', closes: [] },
  ];
  const issues = [
    { number: 7, title: 'Search the queue', comet: false },
    { number: 8, title: 'Comet tails flicker', comet: true },
    { number: 9, title: 'Old idea', comet: false },
  ];

  it('finds a pull request by number, with or without #', () => {
    expect(findOnSky('15', pulls, issues)).toEqual({ kind: 'pull', number: 15 });
    expect(findOnSky(' #12 ', pulls, issues)).toEqual({ kind: 'pull', number: 12 });
  });

  it('finds by a picked suggestion, which starts with the number', () => {
    expect(findOnSky('#8 Comet tails flicker', pulls, issues)).toEqual({ kind: 'comet', issue: 8 });
  });

  it('finds a pull request by title before an issue, ignoring case', () => {
    expect(findOnSky('SEARCH', pulls, issues)).toEqual({ kind: 'pull', number: 12 });
  });

  it('lands an issue an open pull request closes on that star', () => {
    expect(findOnSky('7', pulls, issues)).toEqual({ kind: 'pull', number: 12 });
  });

  it('lands an unclaimed issue on its comet', () => {
    expect(findOnSky('tails', pulls, issues)).toEqual({ kind: 'comet', issue: 8 });
  });

  it('opens any other issue it knows on its own', () => {
    expect(findOnSky('old', pulls, issues)).toEqual({ kind: 'issue', issue: 9 });
  });

  it('finds nothing for a blank or unknown query', () => {
    expect(findOnSky('  ', pulls, issues)).toBeNull();
    expect(findOnSky('404', pulls, issues)).toBeNull();
    expect(findOnSky('nebula', pulls, issues)).toBeNull();
  });

  it('reads a title that starts with a number as a title', () => {
    const titled = [{ number: 20, title: '404 page is blank', closes: [] }];
    expect(findOnSky('404 page', titled, [])).toEqual({ kind: 'pull', number: 20 });
  });
});

describe('searchSuggestions', () => {
  it('lists pull requests, then issues, each led by its number', () => {
    expect(
      searchSuggestions(
        [{ number: 3, title: 'A pull', closes: [] }],
        [{ number: 4, title: 'An issue', comet: true }],
      ),
    ).toEqual(['#3 A pull', '#4 An issue']);
  });
});
