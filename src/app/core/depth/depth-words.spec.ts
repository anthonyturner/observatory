import { depthText, numbersLine, pathParts, spokenSummary, verdictWord } from './depth-words';
import { depthModule } from './testing/depth-fixture';

describe('depthText', () => {
  it('keeps one decimal under ten and rounds from there up', () => {
    expect(depthText(4.25)).toBe('4.3');
    expect(depthText(0)).toBe('0.0');
    expect(depthText(37.4)).toBe('37');
  });
});

describe('pathParts', () => {
  it('splits a name from its folder', () => {
    expect(pathParts(depthModule('src/app/queue.ts', 1, 1))).toEqual({
      name: 'queue.ts',
      folder: 'src/app',
    });
  });

  it('gives a file at the root a name and no folder', () => {
    expect(pathParts(depthModule('main.ts', 1, 1))).toEqual({ name: 'main.ts', folder: '' });
  });
});

describe('what a module says about itself', () => {
  const module = depthModule('src/queue.ts', 42, 6);

  it('lists its three numbers on one line', () => {
    expect(numbersLine(module)).toBe('42 statements · 6 to learn · depth 7.0');
  });

  it('is spoken with its verdict and its counts in the right number', () => {
    expect(spokenSummary(module)).toBe(
      'src/queue.ts, balanced. 42 statements of work, 6 things to learn, depth 7.0.',
    );
    expect(spokenSummary(depthModule('a.ts', 1, 1))).toContain(
      '1 statement of work, 1 thing to learn',
    );
  });

  it('names a verdict in a word', () => {
    expect(verdictWord('shallow')).toBe('Shallow');
  });
});
