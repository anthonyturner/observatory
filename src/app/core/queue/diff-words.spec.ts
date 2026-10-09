import { wordChangesOf } from './diff-words';

describe('wordChangesOf', () => {
  it('marks only the words that differ on each side', () => {
    expect(wordChangesOf('const total = price * 2;', 'const total = cost * 2;')).toEqual({
      removed: [
        { text: 'const total = ', changed: false },
        { text: 'price', changed: true },
        { text: ' * 2;', changed: false },
      ],
      added: [
        { text: 'const total = ', changed: false },
        { text: 'cost', changed: true },
        { text: ' * 2;', changed: false },
      ],
    });
  });

  it('marks a word that was only inserted on the side that has it', () => {
    const changes = wordChangesOf('call(a, b)', 'call(a, extra, b)');

    expect(changes?.removed).toEqual([{ text: 'call(a, b)', changed: false }]);
    expect(changes?.added.filter((span) => span.changed).map((span) => span.text)).toEqual([
      'extra, ',
    ]);
  });

  it('joins changes split only by a space into one span', () => {
    const changes = wordChangesOf('let x = alpha beta gamma;', 'let x = one two gamma;');

    expect(changes?.removed.filter((span) => span.changed)).toEqual([
      { text: 'alpha beta', changed: true },
    ]);
  });

  it('marks nothing for lines that match, or that share too little to compare', () => {
    expect(wordChangesOf('same', 'same')).toBeNull();
    expect(wordChangesOf('old', 'new')).toBeNull();
    expect(wordChangesOf('', 'added')).toBeNull();
    expect(wordChangesOf('short', 'a completely rewritten and much longer line')).toBeNull();
  });

  it('does not compare lines too long to compare cheaply', () => {
    const long = Array.from({ length: 300 }, (_, index) => `w${index}`).join(' ');

    expect(wordChangesOf(long, `${long} more`)).toBeNull();
  });
});
