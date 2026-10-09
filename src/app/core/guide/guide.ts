import { plainOf } from '../library/doc-inline';
import { parseDoc } from '../library/doc-markdown';
import { DocBlock } from '../library/doc.types';
import { blocksText } from '../library/library-search';

/** One feature's explanation: a third-level heading and everything under it. */
export interface GuideSection {
  /** Its heading's anchor, so `/guide#releases` lands on it. */
  readonly id: string;
  readonly title: string;
  /** Its heading first, then its text. */
  readonly blocks: readonly DocBlock[];
  /** Its words as a reader sees them, for search snippets. */
  readonly text: string;
  readonly wordCount: number;
  /** Its part's title, its own title and its text, lower-cased, for matching. */
  readonly haystack: string;
}

/** A group of sections under a second-level heading, such as the Orrery. */
export interface GuidePart {
  readonly id: string;
  readonly title: string;
  /** Its heading and any words before its first section. */
  readonly lead: readonly DocBlock[];
  /** Its heading and lead words, lower-cased, for matching. */
  readonly haystack: string;
  readonly sections: readonly GuideSection[];
}

export interface Guide {
  /** What comes before the first part; the page's own title is left out. */
  readonly intro: readonly DocBlock[];
  readonly parts: readonly GuidePart[];
}

const PART_LEVEL = 2;
const SECTION_LEVEL = 3;
const TITLE_LEVEL = 1;

interface Heading {
  readonly id: string;
  readonly title: string;
  readonly block: DocBlock;
}

interface PartDraft {
  readonly heading: Heading;
  readonly lead: DocBlock[];
  readonly sections: { readonly heading: Heading; readonly blocks: DocBlock[] }[];
}

const headingAt = (block: DocBlock, level: number): Heading | null =>
  block.kind === 'heading' && block.level === level
    ? { id: block.id, title: plainOf(block.spans), block }
    : null;

function sectionOf(partTitle: string, heading: Heading, blocks: readonly DocBlock[]): GuideSection {
  const text = blocksText(blocks);
  return {
    id: heading.id,
    title: heading.title,
    blocks,
    text,
    wordCount: text ? text.split(' ').length : 0,
    haystack: `${partTitle} ${text}`.toLowerCase(),
  };
}

const partOf = (draft: PartDraft): GuidePart => ({
  id: draft.heading.id,
  title: draft.heading.title,
  lead: draft.lead,
  haystack: blocksText(draft.lead).toLowerCase(),
  sections: draft.sections.map(({ heading, blocks }) =>
    sectionOf(draft.heading.title, heading, blocks),
  ),
});

/** The text a block belongs to: the open section, else the open part's lead, else the intro. */
function placeOf(intro: DocBlock[], part: PartDraft | undefined): DocBlock[] {
  if (!part) return intro;
  return part.sections.at(-1)?.blocks ?? part.lead;
}

/** The Guide's Markdown read into parts and sections, through the Library's parser. */
export function guideOf(markdown: string): Guide {
  const intro: DocBlock[] = [];
  const parts: PartDraft[] = [];
  for (const block of parseDoc(markdown).blocks) {
    if (headingAt(block, TITLE_LEVEL)) continue;
    const part = headingAt(block, PART_LEVEL);
    const section = headingAt(block, SECTION_LEVEL);
    const openPart = parts.at(-1);
    if (part) parts.push({ heading: part, lead: [block], sections: [] });
    else if (section && openPart) openPart.sections.push({ heading: section, blocks: [block] });
    else placeOf(intro, openPart).push(block);
  }
  return { intro, parts: parts.map(partOf) };
}

const holdsAll = (haystack: string, terms: readonly string[]): boolean =>
  terms.every((term) => haystack.includes(term));

/** The part with only its sections that hold every term; all of them when its own words do. */
function partMatching(part: GuidePart, terms: readonly string[]): GuidePart {
  if (holdsAll(part.haystack, terms)) return part;
  return {
    ...part,
    sections: part.sections.filter((section) => holdsAll(section.haystack, terms)),
  };
}

/** The parts and sections a search leaves, without the intro; the whole guide with no search. */
export function guideMatching(guide: Guide, terms: readonly string[]): Guide {
  if (!terms.length) return guide;
  const parts = guide.parts
    .map((part) => partMatching(part, terms))
    .filter((part) => part.sections.length > 0);
  return { intro: [], parts };
}

export const sectionCount = (guide: Guide): number =>
  guide.parts.reduce((sum, part) => sum + part.sections.length, 0);
