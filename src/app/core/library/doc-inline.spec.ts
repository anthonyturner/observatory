import { docLinkOf, docSpansOf, plainOf } from './doc-inline';
import { DocSpan, DocText } from './doc.types';

const text = (value: string, strong = false, em = false): DocText => ({
  kind: 'text',
  text: value,
  strong,
  em,
});
const code = (value: string): DocText => ({ kind: 'code', text: value });
const out = (href: string, ...parts: DocText[]): DocSpan => ({
  kind: 'link',
  link: { kind: 'out', href },
  parts,
});

describe('docLinkOf', () => {
  it('follows other sites, Library pages and headings on the page', () => {
    expect(docLinkOf('https://x.dev/a')).toEqual({ kind: 'out', href: 'https://x.dev/a' });
    expect(docLinkOf('mailto:me@x.dev')).toEqual({ kind: 'out', href: 'mailto:me@x.dev' });
    expect(docLinkOf('/p/me/app/library/docs/rules#one%20two')).toEqual({
      kind: 'page',
      path: '/p/me/app/library/docs/rules',
      fragment: 'one two',
    });
    expect(docLinkOf('#install')).toEqual({ kind: 'anchor', fragment: 'install' });
  });

  it('follows nothing else, scripts above all', () => {
    for (const href of ['javascript:alert(1)', 'data:text/html,x', 'docs/a.md', '/p/me/app']) {
      expect(docLinkOf(href), href).toBeNull();
    }
  });
});

describe('docSpansOf', () => {
  it('keeps HTML as text, never as markup', () => {
    expect(docSpansOf('<img src=x onerror=alert(1)> & "q"')).toEqual([
      text('<img src=x onerror=alert(1)> & "q"'),
    ]);
  });

  it('reads bold, italic and code, leaving snake_case and maths alone', () => {
    expect(docSpansOf('**bold** and *it* or _it_, `a_b` in snake_case_name, 2 * 3 * 4')).toEqual([
      text('bold', true),
      text(' and '),
      text('it', false, true),
      text(' or '),
      text('it', false, true),
      text(', '),
      code('a_b'),
      text(' in snake_case_name, 2 * 3 * 4'),
    ]);
  });

  it('keeps markdown inside code as written', () => {
    expect(docSpansOf('``[a](https://x.dev) `b` ``')).toEqual([code('[a](https://x.dev) `b`')]);
  });

  it('reads links with code or bold in them, and bold around them', () => {
    expect(docSpansOf('[`npm ci`](https://x.dev) **[docs](#top)**')).toEqual([
      out('https://x.dev', code('npm ci')),
      text(' '),
      { kind: 'link', link: { kind: 'anchor', fragment: 'top' }, parts: [text('docs', true)] },
    ]);
  });

  it('links bare and bracketed addresses, leaving trailing punctuation out', () => {
    expect(docSpansOf('See https://x.dev/a_b. Or <https://y.dev>.')).toEqual([
      text('See '),
      out('https://x.dev/a_b', text('https://x.dev/a_b')),
      text('. Or '),
      out('https://y.dev', text('https://y.dev')),
      text('.'),
    ]);
  });

  it('keeps a link that goes nowhere allowed as its text', () => {
    expect(docSpansOf('[file](docs/a.md) or [run](javascript:void)')).toEqual([
      text('file'),
      text(' or '),
      text('run'),
    ]);
  });

  it('draws an image GitHub hosts and links to any other', () => {
    const src = 'https://github.com/me/app/raw/main/docs/sky.png';
    expect(docSpansOf(`![The sky](${src}) ![badge](https://img.shields.io/b.svg)`)).toEqual([
      { kind: 'image', alt: 'The sky', src },
      text(' '),
      out('https://img.shields.io/b.svg', text('badge')),
    ]);
  });

  it('draws a linked image with its link', () => {
    const src = 'https://raw.githubusercontent.com/me/app/main/logo.png';
    expect(docSpansOf(`[![logo](${src})](https://x.dev)`)).toEqual([
      {
        kind: 'link',
        link: { kind: 'out', href: 'https://x.dev' },
        parts: [{ kind: 'image', alt: 'logo', src }],
      },
    ]);
  });

  it('resolves reference-style links from the page’s definitions', () => {
    const definitions = new Map([['spec', 'https://x.dev/spec']]);
    expect(docSpansOf('the [spec][] and [it][SPEC] and [none][x]', definitions)).toEqual([
      text('the '),
      out('https://x.dev/spec', text('spec')),
      text(' and '),
      out('https://x.dev/spec', text('it')),
      text(' and [none][x]'),
    ]);
  });

  it('drops harmless inline tags and turns a line break into a space', () => {
    expect(plainOf(docSpansOf('Press <kbd>Ctrl</kbd>+<kbd>C</kbd><br>then `<br>`'))).toBe(
      'Press Ctrl+C then <br>',
    );
  });
});
