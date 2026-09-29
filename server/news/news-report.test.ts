import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseFeed } from './feed-parse.ts';
import { isToolNews, newsReport } from './news-report.ts';
import { summaryFrom } from './news-summary.ts';
import type { NewsSource } from './news-types.ts';

const NOW = Date.parse('2026-09-28T12:00:00Z');

const rss = (items: readonly [title: string, link: string, date: string][]): string =>
  `<?xml version="1.0"?><rss><channel><title>Feed</title><link>https://feed.example/</link>${items
    .map(
      ([title, link, date]) =>
        `<item><title><![CDATA[${title}]]></title><link>${link}</link><pubDate>${date}</pubDate></item>`,
    )
    .join('')}</channel></rss>`;

describe('parseFeed', () => {
  it('reads RSS items, unwrapping CDATA and decoding entities', () => {
    const items = parseFeed(
      rss([['Rust &amp; <b>Go</b>', 'https://a.example/1', 'Mon, 28 Sep 2026 09:00:00 GMT']]),
    );
    assert.deepEqual(items, [
      {
        title: 'Rust & Go',
        url: 'https://a.example/1',
        publishedAt: '2026-09-28T09:00:00.000Z',
        summary: [],
      },
    ]);
  });

  it('reads Atom entries by their alternate link, skipping the feed title', () => {
    const xml = `<feed><title>Blog</title><link href="https://blog.example/" rel="alternate"/>
      <entry><title type="html">Claude Code 3.0</title>
        <link href="https://blog.example/self" rel="self"/>
        <link href="https://blog.example/post?a=1&amp;b=2" rel="alternate"/>
        <updated>2026-09-27T10:00:00+00:00</updated></entry></feed>`;
    assert.deepEqual(parseFeed(xml), [
      {
        title: 'Claude Code 3.0',
        url: 'https://blog.example/post?a=1&b=2',
        publishedAt: '2026-09-27T10:00:00.000Z',
        summary: [],
      },
    ]);
  });

  it('drops items without a title or a web link, and keeps an unparseable date as none', () => {
    const xml =
      '<rss><item><title>No link</title></item>' +
      '<item><title>Bad link</title><link>javascript:alert(1)</link></item>' +
      '<item><title>Undated</title><link>https://a.example/u</link><pubDate>soon</pubDate></item></rss>';
    assert.deepEqual(parseFeed(xml), [
      { title: 'Undated', url: 'https://a.example/u', publishedAt: null, summary: [] },
    ]);
  });
});

describe('feed summaries', () => {
  const story = 'Acme shipped a new coding agent today that writes and runs its own tests.';

  it('takes an escaped RSS description, leaving out captions and boilerplate', () => {
    const escaped =
      '&lt;figure&gt;&lt;figcaption&gt;A photo credit that is long enough to count&lt;/figcaption&gt;&lt;/figure&gt;' +
      `&lt;p&gt;${story}&lt;/p&gt;&lt;p&gt;The post Acme appeared first on The Blog, a long line.&lt;/p&gt;`;
    const [item] = parseFeed(
      `<rss><item><title>Acme</title><link>https://a.example/a</link><description>${escaped}</description></item></rss>`,
    );
    assert.deepEqual(item.summary, [story]);
  });

  it('skips a description that is only links, and uses the full content instead', () => {
    const xml =
      '<rss><item><title>Acme</title><link>https://a.example/a</link>' +
      '<description><![CDATA[<a href="https://news.example/1">Comments</a>]]></description>' +
      `<content:encoded><![CDATA[<p>${story}</p><p>${story}</p><p>${story}</p>]]></content:encoded></item></rss>`;
    assert.deepEqual(parseFeed(xml)[0].summary, [story, story]);
  });

  it('drops the link lists Hacker News searches give', () => {
    const xml =
      '<rss><item><title>Acme</title><link>https://a.example/a</link><description><![CDATA[' +
      '<p>Article URL: <a href="https://a.example/a">https://a.example/a/with/a/long/path</a></p>' +
      '<p>Comments URL: <a href="https://news.example/1">https://news.example/item?id=1</a></p>' +
      ']]></description></item></rss>';
    assert.deepEqual(parseFeed(xml)[0].summary, []);
  });

  it('leaves out a paragraph that only repeats the headline', () => {
    const xml =
      '<rss><item><title>Acme ships agents</title><link>https://a.example/a</link>' +
      `<description><![CDATA[<p>Acme ships agents!</p><p>${story}</p>]]></description></item></rss>`;
    assert.deepEqual(parseFeed(xml)[0].summary, [story]);
  });

  it('cuts a long paragraph at a sentence', () => {
    const long = `${'This sentence is here to be long. '.repeat(20)}`;
    const [cut] = summaryFrom([long]);
    assert.ok(cut.length <= 420 && cut.endsWith('.'), cut);
  });
});

describe('isToolNews', () => {
  it('spots launches, releases and kinds of tool', () => {
    assert.ok(isToolNews('Anthropic releases Claude Code 3'));
    assert.ok(isToolNews('Show HN: an MCP server for Postgres'));
    assert.ok(isToolNews('Cursor ships background agents'));
    assert.ok(!isToolNews('Why AI safety matters for regulators'));
    assert.ok(!isToolNews('AMD will acquire World Labs for $8.2 billion'));
  });
});

describe('newsReport', () => {
  const sources: NewsSource[] = [
    { name: 'AI blog', url: 'ai', topic: 'ai' },
    { name: 'Changelog', url: 'log', topic: 'ai', only: /copilot/i },
    { name: 'Eng blog', url: 'eng', topic: 'engineering' },
    { name: 'Down', url: 'down', topic: 'engineering' },
  ];
  const feeds: Record<string, string> = {
    ai: rss([
      ['Thoughts on AI and jobs', 'https://ai.example/essay', 'Mon, 28 Sep 2026 11:00:00 GMT'],
      [
        'Acme launches a coding agent',
        'https://ai.example/launch',
        'Sun, 27 Sep 2026 08:00:00 GMT',
      ],
      ['An old launch', 'https://ai.example/old', 'Mon, 07 Sep 2026 08:00:00 GMT'],
    ]),
    log: rss([
      [
        'Copilot gets a new model picker',
        'https://log.example/copilot',
        'Sun, 27 Sep 2026 09:00:00 GMT',
      ],
      ['Runner images updated', 'https://log.example/runners', 'Sun, 27 Sep 2026 10:00:00 GMT'],
    ]),
    eng: rss([
      [
        'Acme launches a coding agent',
        'https://www.ai.example/launch/',
        'Sun, 27 Sep 2026 09:00:00 GMT',
      ],
      ['Monorepos at scale', 'https://eng.example/mono', 'Mon, 28 Sep 2026 07:00:00 GMT'],
    ]),
  };
  const fetcher = async (url: string): Promise<string> => {
    const xml = feeds[url];
    if (!xml) throw new Error('offline');
    return xml;
  };

  it('lists AI tools first, keeps a filtered feed to its topic, and drops stale news', async () => {
    const report = await newsReport(sources, fetcher, NOW);
    assert.deepEqual(
      report.ai.map((each) => [each.title, each.tool]),
      [
        ['Copilot gets a new model picker', true],
        ['Acme launches a coding agent', true],
        ['Thoughts on AI and jobs', false],
      ],
    );
  });

  it('reads a summary from the story itself only where the feed gave none', async () => {
    const asked: string[] = [];
    const report = await newsReport(sources, fetcher, NOW, async (url) => {
      asked.push(url);
      return [`Opening of ${url}`];
    });
    assert.deepEqual(report.engineering[0].summary, ['Opening of https://eng.example/mono']);
    assert.equal(asked.length, report.ai.length + report.engineering.length);
  });

  it('lists a story once, under AI, and names the feeds it could not read', async () => {
    const report = await newsReport(sources, fetcher, NOW);
    assert.deepEqual(
      report.engineering.map((each) => [each.title, each.source, each.tool]),
      [['Monorepos at scale', 'Eng blog', false]],
    );
    assert.deepEqual(report.unread, ['Down']);
    assert.equal(report.readAt, '2026-09-28T12:00:00.000Z');
  });
});
