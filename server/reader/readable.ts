/* A page's readable content, taken from its HTML with no browser and no
   library: its title, site, date and lead image from the page's own metadata,
   and the article's headings, paragraphs and list items as plain text. Only
   text leaves here; the site's markup and scripts never reach the dashboard. */

export type BlockKind = 'heading' | 'paragraph' | 'item';

export interface ReadableBlock {
  readonly kind: BlockKind;
  readonly text: string;
}

export interface ReadablePage {
  readonly url: string;
  readonly title: string;
  readonly site: string;
  readonly published: string | null;
  readonly image: string | null;
  readonly blocks: readonly ReadableBlock[];
  /** Whether the site lets itself be shown in a frame on another site. */
  readonly canEmbed: boolean;
  /** Too little text to be the article: a paywall, a sign-in, or a page built by script. */
  readonly isThin: boolean;
}

const MAX_BLOCKS = 80;
const MAX_CHARS = 24_000;
/** A paragraph shorter than this is a caption, a byline or a button, not prose. */
const MIN_PARAGRAPH = 40;
const THIN_CHARS = 600;

/** Where the words are not: dropped with everything inside them. */
const NOISE = [
  'script',
  'style',
  'noscript',
  'svg',
  'template',
  'iframe',
  'nav',
  'header',
  'footer',
  'aside',
  'form',
  'button',
  'figure',
];

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  copy: '©',
  reg: '®',
  trade: '™',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code =
        name[1] === 'x' || name[1] === 'X'
          ? parseInt(name.slice(2), 16)
          : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

const plain = (html: string): string =>
  decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();

/** The content of the first `<meta>` whose `property` or `name` is one of `keys`. */
function meta(html: string, keys: readonly string[]): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i
      .exec(tag)?.[1]
      ?.toLowerCase();
    if (!key || !keys.includes(key)) continue;
    const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (content?.trim()) return decodeEntities(content.trim());
  }
  return null;
}

function withoutNoise(html: string): string {
  let out = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const tag of NOISE) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi'), ' ');
  }
  return out;
}

/** The part of the page that holds the article: `<article>`, else `<main>`, else the body. */
function mainPart(html: string): string {
  for (const tag of ['article', 'main']) {
    const found = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*)<\\/${tag}>`, 'i').exec(html);
    if (found && plain(found[1]).length > THIN_CHARS) return found[1];
  }
  return /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
}

const KIND_OF: Readonly<Record<string, BlockKind>> = {
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  p: 'paragraph',
  li: 'item',
};

function blocksOf(part: string, title: string): ReadableBlock[] {
  const blocks: ReadableBlock[] = [];
  let chars = 0;
  for (const found of part.matchAll(/<(h1|h2|h3|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const kind = KIND_OF[found[1].toLowerCase()];
    const text = plain(found[2]);
    if (!text || (kind === 'heading' && text === title)) continue;
    if (kind !== 'heading' && text.length < MIN_PARAGRAPH) continue;
    if (blocks.some((block) => block.text === text)) continue;
    blocks.push({ kind, text });
    chars += text.length;
    if (blocks.length >= MAX_BLOCKS || chars >= MAX_CHARS) break;
  }
  // A heading with nothing after it is navigation, not a section.
  while (blocks.length && blocks[blocks.length - 1].kind === 'heading') blocks.pop();
  return blocks;
}

/** Whether `X-Frame-Options` or a CSP `frame-ancestors` forbids framing on another site. */
export function allowsEmbedding(headers: Readonly<Record<string, string>>): boolean {
  if (headers['x-frame-options']) return false;
  const ancestors = /frame-ancestors([^;]*)/i.exec(headers['content-security-policy'] ?? '')?.[1];
  if (ancestors === undefined) return true;
  return /(^|\s)\*(\s|$)/.test(ancestors);
}

const absolute = (value: string | null, base: string): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
};

/** The readable page in `html`, fetched from `url` with `headers`. */
export function readablePage(
  html: string,
  url: string,
  headers: Readonly<Record<string, string>>,
): ReadablePage {
  const title =
    meta(html, ['og:title', 'twitter:title']) ??
    plain(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '');
  const site =
    meta(html, ['og:site_name', 'application-name']) ?? new URL(url).hostname.replace(/^www\./, '');
  const published =
    meta(html, ['article:published_time', 'datepublished', 'date', 'pubdate', 'og:updated_time']) ??
    /<time\b[^>]*\bdatetime\s*=\s*["']([^"']+)["']/i.exec(html)?.[1] ??
    null;
  const blocks = blocksOf(mainPart(withoutNoise(html)), title);
  const chars = blocks.reduce((sum, block) => sum + block.text.length, 0);
  return {
    url,
    title: title || site,
    site,
    published,
    image: absolute(meta(html, ['og:image', 'twitter:image']), url),
    blocks,
    canEmbed: allowsEmbedding(headers),
    isThin: chars < THIN_CHARS,
  };
}
