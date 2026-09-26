/**
 * pr-starmap's markdown for a pull request's description, as a model the
 * template draws with ordinary text bindings. A description can be written by
 * anyone who can open a pull request on a public repository, so none of its
 * HTML is ever drawn: every character reaches the page as text, only a
 * handful of shapes are drawn back, a link must be http(s), and an image stays
 * a link, since loading it would tell its host who read the page.
 */

/** A run of text inside a line, bold when it sat between `**`. */
export type Span =
  | { readonly kind: 'text'; readonly text: string; readonly strong: boolean }
  | { readonly kind: 'code'; readonly text: string; readonly strong: false }
  | {
      readonly kind: 'link';
      readonly text: string;
      readonly href: string;
      readonly strong: boolean;
    };

export type Block =
  | { readonly kind: 'h3' | 'h4' | 'p'; readonly spans: readonly Span[] }
  | { readonly kind: 'ul'; readonly items: readonly (readonly Span[])[] }
  | { readonly kind: 'pre'; readonly code: string }
  | {
      readonly kind: 'table';
      readonly head: readonly (readonly Span[])[];
      readonly rows: readonly (readonly (readonly Span[])[])[];
    };

const FENCE = /```[^\n]*\n([\s\S]*?)```/g;
/** GitHub drops HTML comments, an unclosed one to the end; issue templates are full of them. */
const COMMENT = /<!--[\s\S]*?(?:-->|$)/g;
/** Marks where a code block goes back; any in the description are removed first. */
const NUL = String.fromCharCode(0);
const DIGITS = /^\d+$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const HEADING = /^(#{1,4})\s+(.*)$/;
const LIST_ITEM = /^\s*[-*]\s+(?:\[( |x)\]\s+)?(.*)$/i;
const CODE_SPAN = /`([^`]+)`/g;
const STRONG = /\*\*([^*]+)\*\*/g;
const LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
/** `#` and `##` are the larger heading, `###` and `####` the smaller. */
const LARGE_HEADING_MAX = 2;
const CHECKED = '☑ ';
const UNCHECKED = '☐ ';

/** `text` split by `pattern`: the gaps through `plain`, each match through `matched`. */
function splitBy<T>(
  text: string,
  pattern: RegExp,
  plain: (gap: string) => T[],
  matched: (match: RegExpExecArray) => T[],
): T[] {
  const out: T[] = [];
  let at = 0;
  for (const match of text.matchAll(pattern)) {
    out.push(...plain(text.slice(at, match.index)), ...matched(match));
    at = match.index + match[0].length;
  }
  return [...out, ...plain(text.slice(at))];
}

const textSpan = (text: string, strong: boolean): Span[] =>
  text ? [{ kind: 'text', text, strong }] : [];

const withLinks = (text: string, strong: boolean): Span[] =>
  splitBy(
    text,
    LINK,
    (gap) => textSpan(gap, strong),
    (match): Span[] => [{ kind: 'link', text: match[1], href: match[2], strong }],
  );

const withStrong = (text: string): Span[] =>
  splitBy(
    text,
    STRONG,
    (gap) => withLinks(gap, false),
    (match) => withLinks(match[1], true),
  );

/** The inline shapes of one line: code, then bold, then links, as pr-starmap applies them. */
export const spansOf = (line: string): Span[] =>
  splitBy(line, CODE_SPAN, withStrong, (match): Span[] => [
    { kind: 'code', text: match[1], strong: false },
  ]);

const cellsOf = (row: string): Span[][] =>
  row
    .split('|')
    .slice(1, -1)
    .map((cell) => spansOf(cell.trim()));

function tableOf(rows: readonly string[]): Block {
  const [head, , ...body] = rows;
  return { kind: 'table', head: cellsOf(head), rows: body.map(cellsOf) };
}

/** Code blocks out first, marked by NULs, so nothing inside them is read as markdown. */
function withoutFences(source: string): { text: string; fences: string[] } {
  const fences: string[] = [];
  const text = source
    .split(NUL)
    .join('')
    .replace(FENCE, (_, code: string) => {
      fences.push(code);
      return `${NUL}${fences.length - 1}${NUL}`;
    })
    .replace(COMMENT, '');
  return { text, fences };
}

/** Which code block a line stands for, when the line is only its mark. */
function fenceIndex(line: string): number | null {
  if (line.length < 3 || !line.startsWith(NUL) || !line.endsWith(NUL)) return null;
  const inside = line.slice(1, -1);
  return DIGITS.test(inside) ? Number(inside) : null;
}

function listItemOf(match: RegExpMatchArray): Span[] {
  const box = match[1];
  const mark = box === undefined ? '' : box.toLowerCase() === 'x' ? CHECKED : UNCHECKED;
  const spans = spansOf(match[2]);
  return mark ? [{ kind: 'text', text: mark, strong: false }, ...spans] : spans;
}

/** One line on its own: a code block, a heading, or a paragraph; null for a blank line. */
function lineBlock(line: string, fences: readonly string[]): Block | null {
  const fence = fenceIndex(line);
  if (fence !== null) return { kind: 'pre', code: fences[fence] };
  const heading = line.match(HEADING);
  if (heading) {
    const kind = heading[1].length <= LARGE_HEADING_MAX ? 'h3' : 'h4';
    return { kind, spans: spansOf(heading[2]) };
  }
  return line.trim() ? { kind: 'p', spans: spansOf(line) } : null;
}

/** A description as blocks; none at all means it has no description. */
export function markdownBlocks(source: string | null): Block[] {
  const { text, fences } = withoutFences(source ?? '');
  if (!text.trim()) return [];
  const out: Block[] = [];
  let items: Span[][] | null = null;
  let table: string[] | null = null;
  const flushList = (): void => {
    if (items) out.push({ kind: 'ul', items });
    items = null;
  };
  const flushTable = (): void => {
    if (table) out.push(tableOf(table));
    table = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (TABLE_ROW.test(line)) {
      flushList();
      (table ??= []).push(line.trim());
      continue;
    }
    flushTable();
    const item = line.match(LIST_ITEM);
    if (item) {
      (items ??= []).push(listItemOf(item));
      continue;
    }
    flushList();
    const block = lineBlock(line, fences);
    if (block) out.push(block);
  }
  flushList();
  flushTable();
  return out;
}
