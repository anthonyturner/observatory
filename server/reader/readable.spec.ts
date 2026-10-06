import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allowsEmbedding, decodeEntities, readablePage } from './readable.ts';

const para = (words: string): string =>
  `<p>${words} ${'and the story goes on with more detail. '.repeat(3)}</p>`;

const ARTICLE = `<!doctype html><html><head>
  <title>Fallback title</title>
  <meta property="og:title" content="Nvidia buys Hugging Face &amp; more">
  <meta property="og:site_name" content="Example News">
  <meta property="article:published_time" content="2026-09-26T10:00:00Z">
  <meta property="og:image" content="/img/lead.jpg">
  <script>alert('never')</script><style>p{}</style>
</head><body>
  <header><nav><a>Home</a><p>${'Navigation text that should never appear in the reader. '.repeat(2)}</p></nav></header>
  <article>
    <h1>Nvidia buys Hugging Face &amp; more</h1>
    ${para('Nvidia agreed to buy Hugging Face for $13 billion,')}
    <h2>Why it matters</h2>
    ${para('The deal consolidates open-source AI,')}
    <ul><li>A list item that carries enough words to count as prose here.</li></ul>
    <p>Short caption.</p>
    ${para('Regulators are expected to look closely,')}
    ${para('Analysts said the price was steep,')}
    ${para('Shares rose on the news &mdash; by 3%,')}
    <figure><p>${'Figure caption that is long enough but should be dropped with the figure. '.repeat(2)}</p></figure>
    <script>document.write('<p>injected paragraph that must not appear in the output at all</p>')</script>
  </article>
  <footer><p>${'Footer boilerplate that should never be part of the article text. '.repeat(2)}</p></footer>
</body></html>`;

describe('readablePage', () => {
  const page = readablePage(ARTICLE, 'https://www.example.com/news/1', {});

  it("reads the title, site, date and lead image from the page's own metadata", () => {
    assert.equal(page.title, 'Nvidia buys Hugging Face & more');
    assert.equal(page.site, 'Example News');
    assert.equal(page.published, '2026-09-26T10:00:00Z');
    assert.equal(page.image, 'https://www.example.com/img/lead.jpg');
  });

  it("keeps the article's headings, paragraphs and items as plain text, in order", () => {
    assert.deepEqual(
      page.blocks.map((block) => block.kind),
      ['paragraph', 'heading', 'paragraph', 'item', 'paragraph', 'paragraph', 'paragraph'],
    );
    assert.match(page.blocks[0].text, /^Nvidia agreed to buy Hugging Face for \$13 billion,/);
    assert.match(page.blocks[6].text, /news — by 3%/);
    assert.equal(page.isThin, false);
  });

  it('leaves out scripts, navigation, footers, figures, short captions and the repeated title', () => {
    const all = page.blocks.map((block) => block.text).join('\n');
    for (const gone of [
      'alert',
      'Navigation',
      'Footer',
      'Figure caption',
      'Short caption',
      'injected',
    ]) {
      assert.equal(all.includes(gone), false, gone);
    }
  });

  it("says a page with little text is thin, and falls back to the site's name", () => {
    const thin = readablePage(
      '<html><body><p>Subscribe to read.</p></body></html>',
      'https://www.wsj.com/a',
      {},
    );
    assert.equal(thin.isThin, true);
    assert.equal(thin.site, 'wsj.com');
    assert.equal(thin.title, 'wsj.com');
    assert.equal(thin.image, null);
  });

  it('keeps only a web address for the image', () => {
    const odd = readablePage(
      '<meta property="og:image" content="javascript:alert(1)">',
      'https://a.com/',
      {},
    );
    assert.equal(odd.image, null);
  });
});

describe('allowsEmbedding', () => {
  it('is refused by X-Frame-Options or a CSP frame-ancestors that is not *', () => {
    assert.equal(allowsEmbedding({}), true);
    assert.equal(allowsEmbedding({ 'x-frame-options': 'SAMEORIGIN' }), false);
    assert.equal(
      allowsEmbedding({ 'content-security-policy': "default-src 'self'; frame-ancestors 'self'" }),
      false,
    );
    assert.equal(allowsEmbedding({ 'content-security-policy': 'frame-ancestors *' }), true);
    assert.equal(allowsEmbedding({ 'content-security-policy': "default-src 'self'" }), true);
  });
});

describe('decodeEntities', () => {
  it('decodes named and numeric entities, and leaves unknown ones', () => {
    assert.equal(decodeEntities('A &amp; B &#8217;s &#x2014; &bogus;'), 'A & B ’s — &bogus;');
  });
});
