import { parsePrinciplesReport, placeIn } from './principles-parse';

const principle = (id: string) => ({
  id,
  title: `Title ${id}`,
  idea: `Idea ${id}.`,
  question: `Question ${id}?`,
});

describe('parsePrinciplesReport', () => {
  it('reads the deck and where today sits in it', () => {
    const report = parsePrinciplesReport({
      principles: [principle('a'), principle('b')],
      today: 1,
    });

    expect(report).toEqual({ principles: [principle('a'), principle('b')], today: 1 });
  });

  it('drops a principle missing any of its words rather than trusting it', () => {
    const report = parsePrinciplesReport({
      principles: [principle('a'), { ...principle('b'), question: '' }, 'c'],
      today: 0,
    });

    expect(report?.principles.map((each) => each.id)).toEqual(['a']);
  });

  it('keeps today inside the deck it read', () => {
    expect(
      parsePrinciplesReport({ principles: [principle('a'), principle('b')], today: 5 })?.today,
    ).toBe(1);
  });

  it('is null for anything that is not a deck with a day', () => {
    expect(parsePrinciplesReport(null)).toBeNull();
    expect(parsePrinciplesReport({ principles: [], today: 0 })).toBeNull();
    expect(parsePrinciplesReport({ principles: [principle('a')] })).toBeNull();
  });
});

describe('placeIn', () => {
  it('comes round past either end of the deck', () => {
    expect(placeIn(3, 3)).toBe(0);
    expect(placeIn(3, -1)).toBe(2);
    expect(placeIn(3, 1)).toBe(1);
  });
});
