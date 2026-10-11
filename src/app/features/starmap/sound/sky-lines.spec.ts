import { ExitKind } from '../memory/exits';
import {
  CREW_PREPARED_LINES,
  FAREWELLS,
  JEV_PREPARED_LINES,
  RESOLVED_LINE,
  endingLine,
  farewellFor,
} from './sky-lines';

describe('endingLine', () => {
  it('has a line of its own for a single ending of each kind', () => {
    expect(endingLine(['merged'])).toBe('Merged!');
    expect(endingLine(['squashed'])).toBe('Squashed and shipped!');
    expect(endingLine(['closed'])).toBe('Closed. Into the dark it goes.');
  });

  it('joins several of one kind into a count', () => {
    expect(endingLine(['merged', 'merged', 'merged'])).toBe('Three merged!');
    expect(endingLine(['squashed', 'squashed'])).toBe('Two squashed and shipped!');
    expect(endingLine(['closed', 'closed'])).toBe('Two closed. Into the dark they go.');
  });

  it('gives just the count when the endings differ', () => {
    expect(endingLine(['merged', 'closed', 'merged'])).toBe('Three left the sky!');
  });

  it('says "Many" past five rather than counting on', () => {
    const many: ExitKind[] = Array<ExitKind>(6).fill('merged');

    expect(endingLine(many)).toBe('Many merged!');
    expect(endingLine(Array<ExitKind>(5).fill('merged'))).toBe('Five merged!');
  });

  it('says nothing when nothing ended', () => {
    expect(endingLine([])).toBeNull();
  });
});

describe('farewellFor', () => {
  it('is always the same farewell for the same ship', () => {
    expect(farewellFor('crew:7')).toBe(farewellFor('crew:7'));
    expect(farewellFor('agent-a')).toBe(farewellFor('agent-a'));
  });

  it('is one of the few, and a crowd of ships does not all say the same', () => {
    const said = new Set(Array.from({ length: 40 }, (_, i) => farewellFor(`crew:${i}`)));

    expect([...said].every((line) => FAREWELLS.includes(line))).toBe(true);
    expect(said.size).toBeGreaterThan(2);
  });

  it('includes the ones the sky is known for', () => {
    expect(FAREWELLS).toEqual(
      expect.arrayContaining(['Goodbye!', 'To the lull!', 'Back to port, captain!']),
    );
  });
});

describe('the lines made ahead', () => {
  it('are the resolved line and each ending alone for Jev, and every farewell for the crew', () => {
    expect(JEV_PREPARED_LINES).toContain(RESOLVED_LINE);
    expect(JEV_PREPARED_LINES).toContain('Merged!');
    expect(JEV_PREPARED_LINES).toContain('Squashed and shipped!');
    expect(JEV_PREPARED_LINES).toContain('Closed. Into the dark it goes.');
    expect(CREW_PREPARED_LINES).toEqual(FAREWELLS);
  });

  it('never have Jev make a farewell or the crew make one of his', () => {
    expect(JEV_PREPARED_LINES.some((line) => FAREWELLS.includes(line))).toBe(false);
  });
});
