import { guideOf } from '../../../core/guide/guide';
import { contentsOf, resultLineOf } from './guide-view';

const GUIDE = guideOf(`# Guide

## Project tabs

### Releases

Each release is a star sized by what it shipped.

### Actions

Each workflow is a lane.
`);

describe('contentsOf', () => {
  it('draws each part as a shelf and each section as a star linking to its anchor', () => {
    const [shelf] = contentsOf({ guide: GUIDE, link: '/guide', terms: [], currentId: null });

    expect(shelf.name).toBe('Project tabs');
    expect(shelf.entries.map(({ title, link, fragment }) => [title, link, fragment])).toEqual([
      ['Releases', '/guide', 'releases'],
      ['Actions', '/guide', 'actions'],
    ]);
  });

  it('lights the section the address names', () => {
    const [shelf] = contentsOf({ guide: GUIDE, link: '/guide', terms: [], currentId: 'actions' });

    expect(shelf.entries.map((entry) => entry.isCurrent)).toEqual([false, true]);
  });

  it('shows where a search found each section', () => {
    const [shelf] = contentsOf({
      guide: GUIDE,
      link: '/guide',
      terms: ['shipped'],
      currentId: null,
    });

    expect(shelf.entries[0].snippet).toContain('sized by what it shipped');
    expect(shelf.entries[1].snippet).toBeNull();
  });
});

describe('contentsOf for another book', () => {
  it('links each star to the page it was given', () => {
    const [shelf] = contentsOf({
      guide: GUIDE,
      link: '/git-cheat-sheet',
      terms: [],
      currentId: null,
    });

    expect(shelf.entries.map((entry) => entry.link)).toEqual([
      '/git-cheat-sheet',
      '/git-cheat-sheet',
    ]);
  });
});

describe('resultLineOf', () => {
  it('says nothing with no search', () => {
    expect(resultLineOf(3, [], 'the guide')).toBeNull();
  });

  it('counts the sections found, or says none were', () => {
    expect(resultLineOf(1, ['star'], 'the guide')).toBe('1 section matches.');
    expect(resultLineOf(2, ['star'], 'the guide')).toBe('2 sections match.');
    expect(resultLineOf(0, ['comet'], 'the guide')).toBe('Nothing in the guide matches.');
  });

  it('names the book it searched', () => {
    expect(resultLineOf(0, ['comet'], 'the cheat sheet')).toBe(
      'Nothing in the cheat sheet matches.',
    );
  });
});
