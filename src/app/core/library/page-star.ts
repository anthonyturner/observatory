/** The smallest and largest a page's star is drawn, in pixels across. */
const MIN_DIAMETER = 4;
const MAX_DIAMETER = 13;
/** How much a doubling of a page's length grows its star. */
const GROWTH_PER_DOUBLING = 1.7;
/** A page this long or shorter is the smallest star. */
const WORDS_PER_STEP = 100;

/**
 * A page's star in the Library's chart grows with its length, on a log scale
 * so a long reference page does not swallow its neighbours.
 */
export function starDiameterOf(wordCount: number): number {
  const steps = Math.log2(1 + Math.max(0, wordCount) / WORDS_PER_STEP);
  return Math.round(Math.min(MAX_DIAMETER, MIN_DIAMETER + GROWTH_PER_DOUBLING * steps));
}
