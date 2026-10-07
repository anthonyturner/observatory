/**
 * The inline markdown of a Library page, as a model the template draws with
 * ordinary text bindings, as `core/text/markdown.ts` does for a pull request's
 * description. A public wiki can be edited by people the owner does not know,
 * so none of a page's HTML is drawn, a link must go somewhere this allows, and
 * only an image GitHub hosts is loaded.
 */
import { splitBy } from '../text/markdown';
import { DocImage, DocLink, DocLinkPart, DocSpan, DocText, LinkDefinitions } from './doc.types';

interface Style {
  readonly strong: boolean;
  readonly em: boolean;
}

/** Marks where a code span goes back; any in the page are removed first. */
const NUL = String.fromCharCode(0);
const HELD_CODE = new RegExp(`${NUL}(\\d+)${NUL}`, 'g');
const CODE_SPAN = /(`+)([\s\S]*?[^`])\1(?!`)/g;
const STRONG = /\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*|__(?=\S)([\s\S]+?)(?<=\S)__/g;
const EM =
  /\*(?=[^\s*])([^*]+?)(?<=\S)\*|(?<![\p{L}\p{N}_])_(?=[^\s_])([^_]+?)(?<=\S)_(?![\p{L}\p{N}_])/gu;
const REFERENCE = /(!?)\[([^\]]+)\]\[([^\]]*)\]/g;
const TITLE = String.raw`(?:\s+"[^"]*")?`;
/** A linked image, an image, a link, an autolink and a bare URL, in that order of trying. */
const LINKISH = new RegExp(
  [
    String.raw`\[!\[([^\]]*)\]\(([^)\s]+)${TITLE}\)\]\(([^)\s]+)${TITLE}\)`,
    String.raw`!\[([^\]]*)\]\(([^)\s]+)${TITLE}\)`,
    String.raw`\[([^\]]+)\]\(<?([^)\s>]+)>?${TITLE}\)`,
    String.raw`<((?:https?:\/\/|mailto:)[^>\s]+)>`,
    String.raw`https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"]`,
  ].join('|'),
  'g',
);
/** Tags GitHub draws as styling only; a line break reads as a space. */
const INLINE_TAG = /<\/?(?:kbd|sup|sub|b|i|em|strong|span|small|u|ins|mark|abbr)\b[^>]*>/gi;
const LINE_BREAK = /<br\s*\/?>/gi;
const OUT = /^(?:https?:|mailto:)/i;
/** What a link to an image with no words of its own says. */
const IMAGE_LABEL = 'image';
const LIBRARY_PATH = /^\/p\/[^/?#]+\/[^/?#]+\/library(?:\/[^?#]*)?(?:#.*)?$/;
/** Images GitHub serves itself: the reader's browser asks no one else for them. */
const GITHUB_IMAGE =
  /^https:\/\/(?:github\.com\/[^/]+\/[^/]+\/raw\/|github\.com\/user-attachments\/|(?:raw|user-images|private-user-images|avatars)\.githubusercontent\.com\/)/;

function decoded(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** Where `href` goes, or null when it goes nowhere the Library follows. */
export function docLinkOf(href: string): DocLink | null {
  if (href.startsWith('#')) return { kind: 'anchor', fragment: decoded(href.slice(1)) };
  if (LIBRARY_PATH.test(href)) {
    const at = href.indexOf('#');
    return at === -1
      ? { kind: 'page', path: href, fragment: null }
      : { kind: 'page', path: href.slice(0, at), fragment: decoded(href.slice(at + 1)) };
  }
  return OUT.test(href) ? { kind: 'out', href } : null;
}

/** Code spans held out of `text` as numbered marks, so nothing inside them is read as markdown. */
function holdCode(text: string): { held: string; codes: string[] } {
  const codes: string[] = [];
  const held = text
    .split(NUL)
    .join('')
    .replace(CODE_SPAN, (_, __: string, code: string) => {
      codes.push(code.trim() || code);
      return `${NUL}${codes.length - 1}${NUL}`;
    });
  return { held, codes };
}

const imageOf = (alt: string, src: string): DocImage => ({ kind: 'image', alt, src });

class InlineReader {
  constructor(
    private readonly codes: readonly string[],
    private readonly definitions: LinkDefinitions,
  ) {}

  spans(text: string): DocSpan[] {
    return this.withStrong(this.withReferences(text));
  }

  /** `text` with its held code put back as written, for an image's alt text. */
  private released(text: string): string {
    return text.replace(HELD_CODE, (_, index: string) => this.codes[Number(index)] ?? '');
  }

  private withReferences(text: string): string {
    return text.replace(REFERENCE, (whole, bang: string, label: string, ref: string) => {
      const url = this.definitions.get((ref || label).trim().toLowerCase());
      return url ? `${bang}[${label}](${url})` : whole;
    });
  }

  private withStrong(text: string): DocSpan[] {
    return splitBy(
      text,
      STRONG,
      (gap) => this.withEm(gap, false),
      (match) => this.withEm(match[1] ?? match[2], true),
    );
  }

  private withEm(text: string, strong: boolean): DocSpan[] {
    return splitBy(
      text,
      EM,
      (gap) => this.withLinks(gap, { strong, em: false }),
      (match) => this.withLinks(match[1] ?? match[2], { strong, em: true }),
    );
  }

  private withLinks(text: string, style: Style): DocSpan[] {
    return splitBy(
      text,
      LINKISH,
      (gap) => this.texts(gap, style),
      (match) => this.linkish(match, style),
    );
  }

  private linkish(match: RegExpExecArray, style: Style): DocSpan[] {
    const [whole, linkedAlt, linkedSrc, linkedHref, alt, src, label, href, auto] = match;
    if (linkedSrc !== undefined) {
      const words = this.released(linkedAlt);
      const parts = GITHUB_IMAGE.test(linkedSrc)
        ? [imageOf(words, linkedSrc)]
        : this.texts(words || IMAGE_LABEL, style);
      return this.link(parts, linkedHref);
    }
    if (src !== undefined) return this.lonelyImage(this.released(alt), src, style);
    if (href !== undefined) return this.link(this.texts(label, style), href);
    return this.link(this.texts(auto ?? whole, style), auto ?? whole);
  }

  private link(parts: DocLinkPart[], href: string): DocSpan[] {
    const link = docLinkOf(href);
    return link ? [{ kind: 'link', link, parts }] : parts;
  }

  /** A GitHub-hosted image is drawn; any other is a link to it, so the page asks no one else. */
  private lonelyImage(alt: string, src: string, style: Style): DocSpan[] {
    if (GITHUB_IMAGE.test(src)) return [imageOf(alt, src)];
    return this.link(this.texts(alt || IMAGE_LABEL, style), OUT.test(src) ? src : '');
  }

  /** Plain text, with any held code spans put back as code. */
  private texts(text: string, style: Style): DocText[] {
    return splitBy(
      text,
      HELD_CODE,
      (gap): DocText[] => {
        const words = gap.replace(INLINE_TAG, '').replace(LINE_BREAK, ' ');
        return words ? [{ kind: 'text', text: words, ...style }] : [];
      },
      (match): DocText[] => [{ kind: 'code', text: this.codes[Number(match[1])] ?? '' }],
    );
  }
}

/** One paragraph's, heading's or cell's inline markdown as spans. */
export function docSpansOf(text: string, definitions: LinkDefinitions = new Map()): DocSpan[] {
  const { held, codes } = holdCode(text);
  return new InlineReader(codes, definitions).spans(held);
}

/** The words of some spans, as a screen reader or a search would read them. */
export function plainOf(spans: readonly DocSpan[]): string {
  return spans
    .map((span) => {
      switch (span.kind) {
        case 'link':
          return plainOf(span.parts);
        case 'image':
          return span.alt;
        default:
          return span.text;
      }
    })
    .join('');
}
