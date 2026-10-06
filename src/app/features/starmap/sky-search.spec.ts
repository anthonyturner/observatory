import { DoneItem } from '../../core/queue/done-work';
import { findOnSky, searchSuggestions, suggestionParts, suggestionsFor } from './sky-search';

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

  describe('finished work', () => {
    const merged: DoneItem = {
      key: 'pr30',
      kind: 'merged',
      number: 30,
      title: 'Ship the search',
      at: 0,
      day: '2026-10-01',
    };
    const dropped: DoneItem = {
      key: 'issue31',
      kind: 'dropped',
      number: 31,
      title: 'Old idea, again',
      at: 0,
      day: '2026-10-01',
    };
    const done = [merged, dropped];

    it('finds a merged pull request by number or title', () => {
      expect(findOnSky('#30', pulls, issues, done)).toEqual({ kind: 'done', item: merged });
      expect(findOnSky('ship', pulls, issues, done)).toEqual({ kind: 'done', item: merged });
    });

    it('finds it from its picked suggestion', () => {
      expect(findOnSky('#31 Old idea, again · dropped', pulls, issues, done)).toEqual({
        kind: 'done',
        item: dropped,
      });
    });

    it('ranks open work first', () => {
      expect(findOnSky('old idea', pulls, issues, done)).toEqual({ kind: 'issue', issue: 9 });
    });
  });

  it('reads a title that starts with a number as a title', () => {
    const titled = [{ number: 20, title: '404 page is blank', closes: [] }];
    expect(findOnSky('404 page', titled, [])).toEqual({ kind: 'pull', number: 20 });
  });
});

describe('suggestionParts', () => {
  it('sets apart how finished work finished', () => {
    expect(suggestionParts('#5 Shipped · merged')).toEqual({ text: '#5 Shipped', tag: 'merged' });
  });

  it('leaves open work, and a title with its own dot, whole', () => {
    expect(suggestionParts('#3 A pull')).toEqual({ text: '#3 A pull', tag: null });
    expect(suggestionParts('#4 Docs · help')).toEqual({ text: '#4 Docs · help', tag: null });
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

  it('lists finished work last, saying how it finished', () => {
    expect(
      searchSuggestions(
        [{ number: 3, title: 'A pull', closes: [] }],
        [],
        [
          { key: 'pr5', kind: 'merged', number: 5, title: 'Shipped', at: 0, day: '2026-10-01' },
          { key: 'issue6', kind: 'issue', number: 6, title: 'Fixed', at: 0, day: '2026-10-01' },
        ],
      ),
    ).toEqual(['#3 A pull', '#5 Shipped · merged', '#6 Fixed · done']);
  });
});

describe('suggestionsFor', () => {
  const all = ['#3 Add search', '#4 Fix orrery', '#5 Search tweaks'];

  it('keeps the ones holding the text, ignoring case, up to the cap', () => {
    expect(suggestionsFor(all, 'SEARCH', 5)).toEqual(['#3 Add search', '#5 Search tweaks']);
    expect(suggestionsFor(all, '', 2)).toEqual(['#3 Add search', '#4 Fix orrery']);
  });
});
