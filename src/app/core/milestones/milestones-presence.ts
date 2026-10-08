import { isObject } from '../json/json-fields';

/* Kept apart from the report's parser: the tab strip needs only this, and it ships at start-up. */

export const MILESTONES_URL = '/api/milestones';

const isEmptyList = (value: unknown): boolean => Array.isArray(value) && value.length === 0;

/**
 * The project answered with no milestones, open or closed, and no discussions,
 * or Discussions off. An answer with a note, where GitHub gave nothing, is not
 * read as empty: that is not knowing, not knowing there is nothing.
 */
export function hasNothingIn(body: unknown): boolean {
  if (!isObject(body)) return false;
  const { milestones, discussions } = body;
  if (!isObject(milestones) || !isObject(discussions)) return false;
  if (milestones['note'] !== null || discussions['note'] !== null) return false;
  const hasNoDiscussions = discussions['isEnabled'] === false || discussions['total'] === 0;
  return isEmptyList(milestones['open']) && isEmptyList(milestones['closed']) && hasNoDiscussions;
}
