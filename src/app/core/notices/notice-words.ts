import { ActivityItem, ActivityKind } from '../activity/activity.types';

/** A screen reader hears this many items of a check, then how many more. */
const SPOKEN_ITEMS = 3;

const OPENINGS: Readonly<Record<ActivityKind, string>> = {
  merged: 'Pull request merged in',
  issue: 'New issue in',
};

const phraseOf = ({ kind, repo, number, title }: ActivityItem): string =>
  `${OPENINGS[kind]} ${repo}, #${number}: ${title}`;

/** One check's news as a single sentence, for the polite live region. */
export function announcementOf(items: readonly ActivityItem[]): string {
  const phrases = items.slice(0, SPOKEN_ITEMS).map(phraseOf);
  const more = items.length - phrases.length;
  return `${phrases.join('; ')}${more > 0 ? `; and ${more} more` : ''}.`;
}
