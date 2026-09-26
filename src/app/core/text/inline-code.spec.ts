import { codeSpans } from './inline-code';

describe('codeSpans', () => {
  it('marks `inline code` and nothing else', () => {
    expect(codeSpans('Run `git status` then **push**')).toEqual([
      { text: 'Run ', isCode: false },
      { text: 'git status', isCode: true },
      { text: ' then **push**', isCode: false },
    ]);
  });

  it('draws HTML as text, and leaves an unclosed tick alone', () => {
    expect(codeSpans('<b>hi</b> `open')).toEqual([{ text: '<b>hi</b> `open', isCode: false }]);
  });
});
