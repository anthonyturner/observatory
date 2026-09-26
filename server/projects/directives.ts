import type { Directive } from './project-types.ts';
import { bucketRank } from './pull-counts.ts';

/** How many directives Home shows. */
export const DIRECTIVE_COUNT = 3;

const rankOf = (directive: Directive): number => bucketRank(directive.bucket);

/** The most urgent pull requests across every project. Within one state the
 *  one untouched longest comes first, so the backlog drains instead of being
 *  buried by each day's arrivals. */
export function topDirectives(
  candidates: readonly Directive[],
  count = DIRECTIVE_COUNT,
): Directive[] {
  return [...candidates]
    .sort((a, b) => rankOf(a) - rankOf(b) || Date.parse(a.updatedAt) - Date.parse(b.updatedAt))
    .slice(0, count);
}
