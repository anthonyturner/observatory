import { Block, Span, markdownBlocks, spansOf } from './markdown';

const text = (value: string, strong = false): Span => ({ kind: 'text', text: value, strong });
const paragraph = (...spans: Span[]): Block => ({ kind: 'p', spans });

describe('markdownBlocks', () => {
  it('reads nothing, blank lines and comments alone as no description', () => {
    expect(markdownBlocks(null)).toEqual([]);
    expect(markdownBlocks('  \n\n')).toEqual([]);
    expect(markdownBlocks('<!-- template -->\n<!-- unclosed')).toEqual([]);
  });

  it('keeps HTML as text, never as markup', () => {
    expect(markdownBlocks('<img src=x onerror=alert(1)> & "q"')).toEqual([
      paragraph(text('<img src=x onerror=alert(1)> & "q"')),
    ]);
  });

  it('draws headings, paragraphs and lists', () => {
    expect(
      markdownBlocks('## Summary\n#### Detail\nText.\n- one\n* [x] done\n- [ ] todo\n\nAfter'),
    ).toEqual([
      { kind: 'h3', spans: [text('Summary')] },
      { kind: 'h4', spans: [text('Detail')] },
      paragraph(text('Text.')),
      {
        kind: 'ul',
        items: [[text('one')], [text('☑ '), text('done')], [text('☐ '), text('todo')]],
      },
      paragraph(text('After')),
    ]);
  });

  it('keeps a code block whole, comments and markdown inside it included', () => {
    expect(markdownBlocks('```ts\nconst a = 1; <!-- kept -->\n# not a heading\n```')).toEqual([
      { kind: 'pre', code: 'const a = 1; <!-- kept -->\n# not a heading\n' },
    ]);
  });

  it('draws a table, its second line the rule under the head', () => {
    expect(markdownBlocks('| a | **b** |\n|---|---|\n| 1 | `2` |')).toEqual([
      {
        kind: 'table',
        head: [[text('a')], [text('b', true)]],
        rows: [[[text('1')], [{ kind: 'code', text: '2', strong: false }]]],
      },
    ]);
  });

  it('reads lines ending in a carriage return as GitHub writes them', () => {
    expect(markdownBlocks('## Title\r\nBody\r\n')).toEqual([
      { kind: 'h3', spans: [text('Title')] },
      paragraph(text('Body')),
    ]);
  });
});

describe('spansOf', () => {
  it('draws code, bold and http(s) links', () => {
    expect(spansOf('run `npm ci`, **then [docs](https://x.dev/a?b=1&c=2)** now')).toEqual([
      text('run '),
      { kind: 'code', text: 'npm ci', strong: false },
      text(', '),
      text('then ', true),
      { kind: 'link', text: 'docs', href: 'https://x.dev/a?b=1&c=2', strong: true },
      text(' now'),
    ]);
  });

  it('leaves any other link, and an image, as text', () => {
    expect(spansOf('[x](javascript:alert(1)) [y](data:text/html,z) ![i](https://h/i.png)')).toEqual(
      [
        text('[x](javascript:alert(1)) [y](data:text/html,z) !'),
        { kind: 'link', text: 'i', href: 'https://h/i.png', strong: false },
      ],
    );
  });

  it('reads nothing inside a code span as markdown', () => {
    expect(spansOf('`**a** [b](https://c)`')).toEqual([
      { kind: 'code', text: '**a** [b](https://c)', strong: false },
    ]);
  });
});
