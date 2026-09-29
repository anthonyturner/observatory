import { decodeEntities } from '../reader/readable.ts';

/** A summary is a paragraph or two; past this it stops at a sentence, or a word. */
const MAX_PARAGRAPHS = 2;
const MAX_PARAGRAPH_CHARS = 420;
/** Shorter than this is a link, a caption or a button, not a summary. */
const MIN_PARAGRAPH_CHARS = 40;
/** Two paragraphs are not needed when the first says this much. */
const ENOUGH_CHARS = 260;

/** Lines feeds add that are not about the story: link lists, points, "appeared first on". */
const BOILERPLATE =
  /^(article url|comments url|points|# comments)\s*:|appeared first on|^(read more|continue reading)\b/i;

const plain = (html: string): string =>
  decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

/** `text` cut to `max` characters at a sentence end, or else a word, with an ellipsis. */
export function clipped(text: string, max = MAX_PARAGRAPH_CHARS): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const sentence = head.search(/[.!?]["”’)]?\s[^.!?]*$/);
  if (sentence > max / 2) return head.slice(0, sentence + 1).trim();
  const word = head.lastIndexOf(' ');
  return `${head.slice(0, word > max / 2 ? word : max).trim()}…`;
}

const words = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** `summary` less any paragraph that only repeats the headline. */
export function withoutTitle(summary: readonly string[], title: string): string[] {
  const headline = words(title);
  return summary.filter((paragraph) => words(paragraph) !== headline);
}

/** Up to two paragraphs of story from prose paragraphs, boilerplate and captions left out. */
export function summaryFrom(paragraphs: readonly string[]): string[] {
  const summary: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length < MIN_PARAGRAPH_CHARS || BOILERPLATE.test(paragraph)) continue;
    summary.push(clipped(paragraph));
    if (summary.length >= MAX_PARAGRAPHS || summary.join(' ').length >= ENOUGH_CHARS) break;
  }
  return summary;
}

/** The summary in a feed's description or content: HTML, possibly escaped, possibly in CDATA. */
export function feedSummary(raw: string | null): string[] {
  if (!raw) return [];
  let html = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  // Escaped markup (`&lt;p&gt;`) is markup once decoded.
  if (/&lt;\/?[a-z]/i.test(html)) html = decodeEntities(html);
  html = html.replace(/<(figure|figcaption|script|style)\b[\s\S]*?<\/\1>/gi, ' ');
  const paragraphs = html
    .split(/<\/p>|<br\s*\/?>\s*<br\s*\/?>|<\/h\d>|<\/li>|<\/div>/i)
    .map(plain)
    .filter(Boolean);
  return summaryFrom(paragraphs);
}
