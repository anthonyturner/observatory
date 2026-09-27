import { SENTENCE_MAX, joinedSentences, sentences } from './sentences';

describe('sentences', () => {
  it('splits at the end of each sentence and at line breaks', () => {
    expect(sentences('One. Two? Three!\nFour… Five')).toEqual([
      'One.',
      'Two?',
      'Three!',
      'Four…',
      'Five',
    ]);
  });

  it('drops code marks and pieces with no words', () => {
    expect(sentences('Run `npm ci`.\n\n- \n...')).toEqual(['Run npm ci.']);
  });

  it('cuts a long sentence at a comma well into it', () => {
    const first = `${'word '.repeat(20).trim()},`;
    const parts = sentences(`${first} ${'more '.repeat(40).trim()}.`);
    expect(parts[0]).toBe(first);
    expect(parts.every((part) => part.length <= SENTENCE_MAX)).toBe(true);
  });

  it('cuts at a space when no comma comes late enough', () => {
    const parts = sentences(`Hi, ${'long '.repeat(60).trim()}.`);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => part.length <= SENTENCE_MAX)).toBe(true);
    expect(parts.join(' ')).toBe(`Hi, ${'long '.repeat(60).trim()}.`);
  });

  it('cuts a sentence with no spaces at the limit', () => {
    const parts = sentences('x'.repeat(SENTENCE_MAX + 50));
    expect(parts.map((part) => part.length)).toEqual([SENTENCE_MAX, 50]);
  });
});

describe('joinedSentences', () => {
  it('joins sentences into pieces up to the limit, never splitting one', () => {
    expect(joinedSentences('One. Two. Three is longer.', 9)).toEqual([
      'One. Two.',
      'Three is longer.',
    ]);
  });

  it('keeps a whole short reply as one piece', () => {
    expect(joinedSentences('The build is green. Three are ready.', 900)).toEqual([
      'The build is green. Three are ready.',
    ]);
  });

  it('has no pieces for a reply with no words', () => {
    expect(joinedSentences('`` ...', 900)).toEqual([]);
  });
});
