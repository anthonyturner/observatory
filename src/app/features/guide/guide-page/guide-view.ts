import { GUIDE_LINK } from '../../../core/guide/guide-link';
import { Guide, GuideSection } from '../../../core/guide/guide';
import { snippetOf } from '../../../core/library/library-search';
import { starDiameterOf } from '../../../core/library/page-star';
import { plural } from '../../../shared/text/plural';
import { IndexEntry, IndexShelf } from '../../library/library-page/library-view';

/** What the contents are drawn from. */
export interface ContentsInput {
  readonly guide: Guide;
  readonly terms: readonly string[];
  /** The anchor the address names, lit in the contents; null with none. */
  readonly currentId: string | null;
}

function entryOf(section: GuideSection, input: ContentsInput): IndexEntry {
  return {
    slug: section.id,
    title: section.title,
    link: GUIDE_LINK,
    fragment: section.id,
    diameter: starDiameterOf(section.wordCount),
    isCurrent: section.id === input.currentId,
    snippet: input.terms.length ? snippetOf(section.text, input.terms) : null,
  };
}

/** The Guide's contents as the Library's star chart: a constellation per part, a star per section. */
export const contentsOf = (input: ContentsInput): IndexShelf[] =>
  input.guide.parts.map((part) => ({
    name: part.title,
    entries: part.sections.map((section) => entryOf(section, input)),
  }));

/** What a search found, said aloud; null with no search. */
export function resultLineOf(found: number, terms: readonly string[]): string | null {
  if (!terms.length) return null;
  if (!found) return 'Nothing in the guide matches.';
  return `${plural(found, 'section')} ${found === 1 ? 'matches' : 'match'}.`;
}
