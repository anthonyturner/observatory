import { plainOf } from './doc-inline';
import { parseDoc } from './doc-markdown';
import { DocBlock, DocText } from './doc.types';

const text = (value: string): DocText => ({ kind: 'text', text: value, strong: false, em: false });
const paragraph = (value: string): DocBlock => ({ kind: 'p', spans: [text(value)] });
const kinds = (blocks: readonly DocBlock[]): string[] => blocks.map((block) => block.kind);

describe('parseDoc', () => {
  it('joins a wrapped paragraph and splits paragraphs at blank lines', () => {
    expect(parseDoc('One line\nwrapped here.\n\nNext.').blocks).toEqual([
      paragraph('One line wrapped here.'),
      paragraph('Next.'),
    ]);
  });

  it('gives headings GitHub’s anchors, numbering repeats, and outlines levels two and three', () => {
    const { blocks, outline } = parseDoc(
      '# Title\n## Set up & run\n### Set up & run\nSetext\n---\n#### Deep',
    );

    expect(blocks.map((block) => (block.kind === 'heading' ? block.id : null))).toEqual([
      'title',
      'set-up--run',
      'set-up--run-1',
      'setext',
      'deep',
    ]);
    expect(outline).toEqual([
      { id: 'set-up--run', text: 'Set up & run', level: 2 },
      { id: 'set-up--run-1', text: 'Set up & run', level: 3 },
      { id: 'setext', text: 'Setext', level: 2 },
    ]);
  });

  it('keeps a fenced block whole, with its language, comments and markdown inside it', () => {
    expect(
      parseDoc('```ts\nconst a = 1; <!-- kept -->\n# not a heading\n```\nAfter').blocks,
    ).toEqual([
      { kind: 'pre', code: 'const a = 1; <!-- kept -->\n# not a heading', language: 'ts' },
      paragraph('After'),
    ]);
  });

  it('cuts HTML comments, a template’s across lines included', () => {
    expect(parseDoc('Keep <!-- cut --> this\n<!--\nall\ngone\n-->\nAnd this').blocks).toEqual([
      paragraph('Keep  this'),
      paragraph('And this'),
    ]);
  });

  it('reads nested, ordered and task lists, with paragraphs inside an item', () => {
    const [list] = parseDoc(
      '1. First\n   wrapped\n   - inner\n   - [x] done\n\n   More of first.\n2. Second',
    ).blocks;

    expect(list.kind).toBe('list');
    if (list.kind !== 'list') return;
    expect(list.ordered).toBe(true);
    expect(list.items.map((item) => plainOf(item.spans))).toEqual(['First wrapped', 'Second']);
    const [inner, more] = list.items[0].blocks;
    expect(inner.kind === 'list' && inner.items.map((item) => item.checked)).toEqual([null, true]);
    expect(more).toEqual(paragraph('More of first.'));
  });

  it('starts an ordered list from its first number, and splits lists by kind', () => {
    const blocks = parseDoc('3. three\n4. four\n- bullet').blocks;

    expect(
      blocks.map((block) => (block.kind === 'list' ? [block.ordered, block.start] : [])),
    ).toEqual([
      [true, 3],
      [false, 1],
    ]);
  });

  it('reads quotes, rules and tables, with escaped pipes in cells', () => {
    const { blocks } = parseDoc(
      '> Quoted\n> **text**\n\n---\n\n| a | b |\n|---|:-:|\n| 1 | x \\| y |',
    );

    expect(kinds(blocks)).toEqual(['quote', 'rule', 'table']);
    const table = blocks[2];
    expect(table.kind === 'table' && table.rows[0].map((cell) => plainOf(cell))).toEqual([
      '1',
      'x | y',
    ]);
  });

  it('draws the images in a line of HTML and drops its other tags', () => {
    const src = 'https://github.com/me/app/raw/main/logo.png';
    const blocks = parseDoc(
      `<p align="center">\n  <img src="${src}" alt="Logo">\n</p>\n<details>`,
    ).blocks;

    expect(blocks).toEqual([{ kind: 'p', spans: [{ kind: 'image', alt: 'Logo', src }] }]);
  });

  it('uses reference definitions and leaves them out of the page', () => {
    const { blocks } = parseDoc('See [the spec].\n\n[the spec]: https://x.dev/spec\n');

    expect(blocks.length).toBe(1);
    expect(plainOf(blocks[0].kind === 'p' ? blocks[0].spans : [])).toBe('See [the spec].');
  });
});
