import { ActivityItem, ActivityKind } from '../activity/activity.types';

/** A screen reader hears this many items of a check, then how many more. */
const SPOKEN_ITEMS = 3;
/** Jev says this many items of a line, then how many more. */
const SAID_ITEMS = 3;

const OPENINGS: Readonly<Record<ActivityKind, string>> = {
  merged: 'Pull request merged in',
  issue: 'New issue in',
};

/** Jev's words name the project as it is shown, and the number without its
 *  "#", which a voice would read out. */
const SAYINGS: Readonly<Record<ActivityKind, (item: ActivityItem) => string>> = {
  merged: ({ number, label, title }) => `Pull request ${number} in ${label} merged: ${title}`,
  issue: ({ number, label, title }) => `New issue ${number} in ${label}: ${title}`,
};

const ENDS_A_SENTENCE = /[.!?]$/;

const phraseOf = ({ kind, repo, number, title }: ActivityItem): string =>
  `${OPENINGS[kind]} ${repo}, #${number}: ${title}`;

const sentenceOf = (words: string): string => {
  const trimmed = words.trim();
  return ENDS_A_SENTENCE.test(trimmed) ? trimmed : `${trimmed}.`;
};

/** One check's news as a single sentence, for the polite live region. */
export function announcementOf(items: readonly ActivityItem[]): string {
  const phrases = items.slice(0, SPOKEN_ITEMS).map(phraseOf);
  const more = items.length - phrases.length;
  return `${phrases.join('; ')}${more > 0 ? `; and ${more} more` : ''}.`;
}

/** The news as Jev says it: one sentence an item, then how many more. */
export function sayingOf(items: readonly ActivityItem[]): string {
  const said = items.slice(0, SAID_ITEMS).map((item) => sentenceOf(SAYINGS[item.kind](item)));
  const more = items.length - said.length;
  return [...said, ...(more > 0 ? [`And ${more} more.`] : [])].join(' ');
}
