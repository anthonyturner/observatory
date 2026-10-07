import { docSpansOf, plainOf } from './doc-inline';
import {
  DocBlock,
  DocCells,
  DocListItem,
  DocSpan,
  HeadingLevel,
  LinkDefinitions,
  OutlineEntry,
  ParsedDoc,
} from './doc.types';
import { FENCE, docSource } from './doc-source';

interface ListMark {
  readonly indent: number;
  readonly ordered: boolean;
  readonly start: number;
  /** Where the item's own text starts; deeper lines belong to it. */
  readonly contentIndent: number;
  readonly text: string;
}

const HEADING = /^ {0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/;
const SETEXT = /^ {0,3}(=+|-+)\s*$/;
const RULE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
const LIST_ITEM = /^( *)([-*+]|\d{1,9}[.)])( +|$)(.*)$/;
const TASK = /^\[( |x|X)\]\s+/;
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const ESCAPED_PIPE = /\\\|/g;
/** A pipe that is not escaped, between two cells. */
const CELL_EDGE = /(?<!\\)\|/;
const HTML_LINE = /^\s*<\/?[a-zA-Z][^>]*>(?:\s*<\/?[a-zA-Z][^>]*>)*\s*$/;
const HTML_IMAGE = /<img\b[^>]*>/gi;
const HTML_SRC = /\bsrc="([^"]+)"/i;
const HTML_ALT = /\balt="([^"]*)"/i;
/** A marker followed by more than this many spaces starts its text one space in. */
const MAX_MARK_GAP = 4;
const LEVELS: readonly HeadingLevel[] = [1, 2, 3, 4, 5, 6];
const OUTLINE_LEVELS: readonly HeadingLevel[] = [2, 3];
const NO_ID = 'section';

const isBlank = (line: string): boolean => !line.trim();
const indentOf = (line: string): number => line.length - line.trimStart().length;

function listMarkOf(line: string): ListMark | null {
  const match = LIST_ITEM.exec(line);
  if (!match || RULE.test(line)) return null;
  const [, lead, marker, gap, text] = match;
  const ordered = /\d/.test(marker);
  const gapWidth = gap.length > MAX_MARK_GAP || !text ? 1 : gap.length;
  return {
    indent: lead.length,
    ordered,
    start: ordered ? Number.parseInt(marker, 10) : 1,
    contentIndent: lead.length + marker.length + gapWidth,
    text,
  };
}

const isTableStart = (lines: readonly string[], at: number): boolean =>
  lines[at].includes('|') && at + 1 < lines.length && TABLE_RULE.test(lines[at + 1]);

/** True when `line` begins a block of its own, so a paragraph stops before it. */
function startsBlock(lines: readonly string[], at: number): boolean {
  const line = lines[at];
  return (
    HEADING.test(line) ||
    FENCE.test(line) ||
    QUOTE.test(line) ||
    RULE.test(line) ||
    listMarkOf(line) !== null ||
    HTML_LINE.test(line) ||
    isTableStart(lines, at)
  );
}

/** GitHub's anchors: lower case, punctuation dropped, spaces as hyphens, repeats numbered. */
class Slugger {
  private readonly seen = new Map<string, number>();

  slug(text: string): string {
    const base =
      text
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .replace(/\s/g, '-') || NO_ID;
    const count = this.seen.get(base) ?? 0;
    this.seen.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  }
}

const cellsOf = (row: string, definitions: LinkDefinitions): DocSpan[][] =>
  row
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(CELL_EDGE)
    .map((cell) => docSpansOf(cell.replace(ESCAPED_PIPE, '|').trim(), definitions));

/** Reads lines into blocks; one per page, so headings share one set of anchors. */
class BlockReader {
  private readonly slugger = new Slugger();

  constructor(private readonly definitions: LinkDefinitions) {}

  blocks(lines: readonly string[]): DocBlock[] {
    const out: DocBlock[] = [];
    let at = 0;
    while (at < lines.length) {
      if (isBlank(lines[at])) {
        at++;
        continue;
      }
      const [block, next] = this.block(lines, at);
      if (block) out.push(block);
      at = next;
    }
    return out;
  }

  /** The block starting at `at`, or null for a line that draws nothing, and the line after it. */
  private block(lines: readonly string[], at: number): [DocBlock | null, number] {
    const line = lines[at];
    const fence = FENCE.exec(line);
    if (fence) return this.fence(lines, at, fence);
    const heading = HEADING.exec(line);
    if (heading) return [this.heading(heading[1].length, heading[2] ?? ''), at + 1];
    if (RULE.test(line)) return [{ kind: 'rule' }, at + 1];
    if (QUOTE.test(line)) return this.quote(lines, at);
    const mark = listMarkOf(line);
    if (mark) return this.list(lines, at, mark);
    if (isTableStart(lines, at)) return this.table(lines, at);
    if (HTML_LINE.test(line)) return [this.htmlImages(line), at + 1];
    return this.paragraph(lines, at);
  }

  private spans(text: string): DocSpan[] {
    return docSpansOf(text, this.definitions);
  }

  private heading(depth: number, text: string): DocBlock {
    const spans = this.spans(text);
    const level = LEVELS[depth - 1] ?? LEVELS[LEVELS.length - 1];
    return { kind: 'heading', level, id: this.slugger.slug(plainOf(spans)), spans };
  }

  private fence(lines: readonly string[], at: number, open: RegExpExecArray): [DocBlock, number] {
    const [, lead, marker, language] = open;
    const code: string[] = [];
    let next = at + 1;
    while (next < lines.length) {
      const close = FENCE.exec(lines[next]);
      if (close && close[2][0] === marker[0] && close[2].length >= marker.length && !close[3]) {
        next++;
        break;
      }
      const line = lines[next];
      code.push(line.slice(Math.min(lead.length, indentOf(line))));
      next++;
    }
    return [{ kind: 'pre', code: code.join('\n'), language }, next];
  }

  private quote(lines: readonly string[], at: number): [DocBlock, number] {
    const inner: string[] = [];
    let next = at;
    while (next < lines.length && !isBlank(lines[next])) {
      const quoted = QUOTE.exec(lines[next]);
      if (!quoted && startsBlock(lines, next)) break;
      inner.push(quoted ? quoted[1] : lines[next].trim());
      next++;
    }
    return [{ kind: 'quote', blocks: this.blocks(inner) }, next];
  }

  private table(lines: readonly string[], at: number): [DocBlock, number] {
    const rows: DocCells[] = [];
    let next = at + 2;
    while (next < lines.length && !isBlank(lines[next]) && lines[next].includes('|')) {
      rows.push(cellsOf(lines[next], this.definitions));
      next++;
    }
    return [{ kind: 'table', head: cellsOf(lines[at], this.definitions), rows }, next];
  }

  /** A line of HTML draws only the images GitHub hosts in it; its other tags are dropped. */
  private htmlImages(line: string): DocBlock | null {
    const images = [...line.matchAll(HTML_IMAGE)].flatMap(([tag]) => {
      const src = HTML_SRC.exec(tag)?.[1];
      return src ? [`![${HTML_ALT.exec(tag)?.[1] ?? ''}](${src})`] : [];
    });
    return images.length ? { kind: 'p', spans: this.spans(images.join(' ')) } : null;
  }

  private paragraph(lines: readonly string[], at: number): [DocBlock, number] {
    const text: string[] = [lines[at].trim()];
    let next = at + 1;
    while (next < lines.length && !isBlank(lines[next])) {
      const underline = SETEXT.exec(lines[next]);
      if (underline) {
        const depth = underline[1].startsWith('=') ? 1 : 2;
        return [this.heading(depth, text.join(' ')), next + 1];
      }
      if (startsBlock(lines, next)) break;
      text.push(lines[next].trim());
      next++;
    }
    return [{ kind: 'p', spans: this.spans(text.join(' ')) }, next];
  }

  private list(lines: readonly string[], at: number, first: ListMark): [DocBlock, number] {
    const items: DocListItem[] = [];
    let next = at;
    let contentIndent = first.contentIndent;
    while (next < lines.length) {
      const mark = listMarkOf(lines[next]);
      if (!mark || mark.ordered !== first.ordered || mark.indent >= contentIndent) break;
      const [body, after] = this.itemBody(lines, next, mark);
      items.push(this.item(mark.text, body));
      contentIndent = mark.contentIndent;
      next = after;
      if (next < lines.length && isBlank(lines[next])) next = this.skipBlanks(lines, next);
    }
    return [{ kind: 'list', ordered: first.ordered, start: first.start, items }, next];
  }

  private skipBlanks(lines: readonly string[], at: number): number {
    let next = at;
    while (next < lines.length && isBlank(lines[next])) next++;
    const mark = next < lines.length ? listMarkOf(lines[next]) : null;
    return mark ? next : at;
  }

  /** The lines after an item's marker that belong to it, its indent taken off. */
  private itemBody(lines: readonly string[], at: number, mark: ListMark): [string[], number] {
    const body = [mark.text];
    let next = at + 1;
    let sawBlank = false;
    while (next < lines.length) {
      const line = lines[next];
      if (isBlank(line)) {
        sawBlank = true;
        body.push('');
      } else if (indentOf(line) >= mark.contentIndent) {
        body.push(line.slice(mark.contentIndent));
      } else if (sawBlank || startsBlock(lines, next)) {
        break;
      } else {
        body.push(line.trim());
      }
      next++;
    }
    while (body.length > 1 && isBlank(body[body.length - 1])) {
      body.pop();
      next--;
    }
    return [body, next];
  }

  private item(text: string, body: string[]): DocListItem {
    const task = TASK.exec(text);
    const lines = task ? [text.slice(task[0].length), ...body.slice(1)] : body;
    const blocks = this.blocks(lines);
    const [lead, ...rest] = blocks;
    const checked = task ? task[1] !== ' ' : null;
    return lead?.kind === 'p'
      ? { spans: lead.spans, checked, blocks: rest }
      : { spans: [], checked, blocks };
  }
}

const outlineOf = (blocks: readonly DocBlock[]): OutlineEntry[] =>
  blocks.flatMap((block) =>
    block.kind === 'heading' && OUTLINE_LEVELS.includes(block.level)
      ? [{ id: block.id, text: plainOf(block.spans), level: block.level }]
      : [],
  );

/** A Library page as blocks to draw, and its headings for the "On this page" list. */
export function parseDoc(markdown: string): ParsedDoc {
  const { lines, definitions } = docSource(markdown);
  const blocks = new BlockReader(definitions).blocks(lines);
  return { blocks, outline: outlineOf(blocks) };
}
