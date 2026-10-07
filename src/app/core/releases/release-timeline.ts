import { Release, ReleaseNotes, ReleasesReport, ShippedPull } from './releases-report';

/** How far a release moved its version from the one before: what colours its star. */
export type VersionBump = 'major' | 'minor' | 'patch' | 'other';

/** The selection key of the Unreleased comet; a release's is its tag. */
export const UNRELEASED_KEY = 'unreleased';

/** One week of work merged since the last release. */
export interface MergedWeek {
  /** The Monday it starts on, as `YYYY-MM-DD` in local time. */
  readonly key: string;
  readonly start: number;
  /** Most recently merged first. */
  readonly pulls: readonly ShippedPull[];
}

export interface TimelineRelease {
  readonly release: Release;
  readonly bump: VersionBump;
}

export interface UnreleasedWork {
  readonly notes: ReleaseNotes | null;
  /** Most recently merged first. */
  readonly pulls: readonly ShippedPull[];
  /** Oldest first, as the tail runs toward the head. */
  readonly weeks: readonly MergedWeek[];
}

/** The releases in the order the trajectory runs, and the work since. */
export interface ReleaseTimeline {
  /** Oldest first. */
  readonly releases: readonly TimelineRelease[];
  /** Null when nothing has merged since the last release and the changelog lists nothing. */
  readonly unreleased: UnreleasedWork | null;
}

const VERSION = /^v?(\d+)\.(\d+)(?:\.(\d+))?/i;

const versionOf = (tag: string): readonly number[] | null => {
  const match = tag.trim().match(VERSION);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)] : null;
};

/** What changed from `previous` to `tag`: the first release counts as major. */
export function bumpOf(tag: string, previous: string | null): VersionBump {
  const now = versionOf(tag);
  if (!now) return 'other';
  if (previous === null) return 'major';
  const before = versionOf(previous);
  if (!before) return 'other';
  if (now[0] !== before[0]) return 'major';
  return now[1] !== before[1] ? 'minor' : 'patch';
}

const twoDigits = (value: number): string => String(value).padStart(2, '0');
const DAYS_FROM_MONDAY = 6;

/** The local Monday a moment falls in, at midnight. */
export function weekStartOf(ms: number): Date {
  const day = new Date(ms);
  const sinceMonday = (day.getDay() + DAYS_FROM_MONDAY) % 7;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - sinceMonday);
}

/** Merged pull requests grouped by the local week they merged in, oldest week first. */
export function weeksOf(pulls: readonly ShippedPull[]): MergedWeek[] {
  const weeks = new Map<string, { start: number; pulls: ShippedPull[] }>();
  const newestFirst = [...pulls].sort((a, b) => b.mergedAt - a.mergedAt);
  for (const pull of newestFirst) {
    const monday = weekStartOf(pull.mergedAt);
    const key = `${monday.getFullYear()}-${twoDigits(monday.getMonth() + 1)}-${twoDigits(monday.getDate())}`;
    const week = weeks.get(key) ?? { start: monday.getTime(), pulls: [] };
    week.pulls.push(pull);
    weeks.set(key, week);
  }
  return [...weeks.entries()]
    .map(([key, week]) => ({ key, ...week }))
    .sort((a, b) => a.start - b.start);
}

/** The report as the trajectory draws it: releases oldest first, each with its bump, and the work since. */
export function releaseTimeline(report: ReleasesReport): ReleaseTimeline {
  const oldestFirst = [...report.releases].sort((a, b) => a.publishedAt - b.publishedAt);
  const releases = oldestFirst.map((release, index) => ({
    release,
    bump: bumpOf(release.tag, index ? oldestFirst[index - 1].tag : null),
  }));
  const { notes, pulls } = report.unreleased;
  const hasWork = pulls.length > 0 || notes !== null;
  return { releases, unreleased: hasWork ? { notes, pulls, weeks: weeksOf(pulls) } : null };
}
