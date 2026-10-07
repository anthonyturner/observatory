import { VersionBump } from '../../core/releases/release-timeline';
import { plural } from '../../shared/text/plural';

/* How the Releases screen names its dates, counts and kinds of release. */

/** "3 Oct 2026", in the given locale or the browser's. */
export const dateWords = (ms: number, locale?: string): string =>
  new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

/** "Week of 28 Sep", in the given locale or the browser's. */
export const weekWords = (start: number, locale?: string): string =>
  `Week of ${new Date(start).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;

/** "12 PRs": short enough to sit under a star. */
export const pullCountWords = (count: number): string => plural(count, 'PR');

/** "12 merged pull requests", for a screen reader and the panel. */
export const mergedWords = (count: number): string => plural(count, 'merged pull request');

export const BUMP_WORDS: Readonly<Record<VersionBump, string>> = {
  major: 'Major release',
  minor: 'Minor release',
  patch: 'Patch release',
  other: 'Release',
};
