/** The model a Library page is read into, which templates draw with text bindings only. */

/** Where a link goes: another site, a page of the Library, or a heading on this page. */
export type DocLink =
  | { readonly kind: 'out'; readonly href: string }
  | { readonly kind: 'page'; readonly path: string; readonly fragment: string | null }
  | { readonly kind: 'anchor'; readonly fragment: string };

/** A run of text, bold or italic as it was marked, or a code span. */
export type DocText =
  | {
      readonly kind: 'text';
      readonly text: string;
      readonly strong: boolean;
      readonly em: boolean;
    }
  | { readonly kind: 'code'; readonly text: string };

/** An image GitHub hosts; any other is turned into a link to it before it gets here. */
export interface DocImage {
  readonly kind: 'image';
  readonly alt: string;
  readonly src: string;
}

/** What a link can hold. */
export type DocLinkPart = DocText | DocImage;

export type DocSpan =
  | DocLinkPart
  | { readonly kind: 'link'; readonly link: DocLink; readonly parts: readonly DocLinkPart[] };

/** Reference-style link definitions, `[label]: url`, by lower-cased label. */
export type LinkDefinitions = ReadonlyMap<string, string>;

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface DocListItem {
  readonly spans: readonly DocSpan[];
  /** A task's box, ticked or not; null for an ordinary item. */
  readonly checked: boolean | null;
  /** What the item holds after its first paragraph: more text, a nested list, code. */
  readonly blocks: readonly DocBlock[];
}

export type DocCells = readonly (readonly DocSpan[])[];

export type DocBlock =
  | {
      readonly kind: 'heading';
      readonly level: HeadingLevel;
      /** The anchor GitHub gives it, so links written for GitHub land on it. */
      readonly id: string;
      readonly spans: readonly DocSpan[];
    }
  | { readonly kind: 'p'; readonly spans: readonly DocSpan[] }
  | {
      readonly kind: 'list';
      readonly ordered: boolean;
      readonly start: number;
      readonly items: readonly DocListItem[];
    }
  | { readonly kind: 'quote'; readonly blocks: readonly DocBlock[] }
  | { readonly kind: 'pre'; readonly code: string; readonly language: string }
  | { readonly kind: 'table'; readonly head: DocCells; readonly rows: readonly DocCells[] }
  | { readonly kind: 'rule' };

/** One heading in the page's "On this page" list. */
export interface OutlineEntry {
  readonly id: string;
  readonly text: string;
  readonly level: HeadingLevel;
}

export interface ParsedDoc {
  readonly blocks: readonly DocBlock[];
  readonly outline: readonly OutlineEntry[];
}
