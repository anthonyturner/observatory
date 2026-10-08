import { JournalEntry } from '../../../core/journal/journal-report';
import { Principle } from '../../../core/principles/principle.types';
import { cardsOf, chipsOf } from './journal-view';

const entry = (pull: number, principles: string[]): JournalEntry => ({
  pull,
  url: `https://github.com/me/app/pull/${pull}#issuecomment-${pull}`,
  postedAt: Date.UTC(2026, 9, 8, 12),
  firstVersion: `First ${pull}`,
  feedback: `Feedback ${pull}`,
  change: `Change ${pull}`,
  principles,
});

const principle = (id: string, title: string): Principle => ({
  id,
  title,
  idea: `Idea of ${id}`,
  question: `Question of ${id}`,
});

const TITLES = new Map([
  ['deep-modules', principle('deep-modules', 'Make modules deep')],
  ['design-it-twice', principle('design-it-twice', 'Design it twice')],
]);

const ENTRIES = [
  entry(3, ['design-it-twice']),
  entry(2, ['deep-modules', 'design-it-twice']),
  entry(1, ['gone-from-the-deck']),
];

describe('chipsOf', () => {
  it('counts the lessons each principle taught, the most taught first then by label', () => {
    expect(chipsOf(ENTRIES, TITLES)).toEqual([
      { id: 'design-it-twice', label: 'Design it twice', count: 2 },
      { id: 'gone-from-the-deck', label: 'gone-from-the-deck', count: 1 },
      { id: 'deep-modules', label: 'Make modules deep', count: 1 },
    ]);
  });

  it('falls back to the ids while the principles are not read', () => {
    expect(chipsOf([entry(1, ['deep-modules'])], new Map())[0].label).toBe('deep-modules');
  });

  it('has no chips when there are no lessons', () => {
    expect(chipsOf([], TITLES)).toEqual([]);
  });
});

describe('cardsOf', () => {
  it('draws every lesson in order, with its principles labelled', () => {
    const cards = cardsOf(ENTRIES, TITLES, null);

    expect(cards.map((card) => card.pull)).toEqual([3, 2, 1]);
    expect(cards[1].principles).toEqual([
      { id: 'deep-modules', label: 'Make modules deep' },
      { id: 'design-it-twice', label: 'Design it twice' },
    ]);
    expect(cards[0].firstVersion).toBe('First 3');
    expect(new Set(cards.map((card) => card.key)).size).toBe(3);
  });

  it('narrows to the lessons that taught the picked principle', () => {
    expect(cardsOf(ENTRIES, TITLES, 'deep-modules').map((card) => card.pull)).toEqual([2]);
    expect(cardsOf(ENTRIES, TITLES, 'design-it-twice').map((card) => card.pull)).toEqual([3, 2]);
  });
});
