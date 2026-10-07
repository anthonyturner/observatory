import {
  ReleaseTimeline,
  UNRELEASED_KEY,
  UnreleasedWork,
  TimelineRelease,
} from '../../../core/releases/release-timeline';
import { ReleaseNotes, ShippedPull } from '../../../core/releases/releases-report';
import { BUMP_WORDS, dateWords, mergedWords, weekWords } from '../release-words';

export interface PullRow {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly merged: string;
  readonly author: string;
}

/** A run of pull requests under one heading, or none for a release's single list. */
export interface PullGroup {
  readonly key: string;
  readonly heading: string | null;
  readonly rows: readonly PullRow[];
}

/** One release, or the Unreleased work, as the panel shows it. */
export interface ReleaseDetail {
  readonly key: string;
  readonly title: string;
  readonly kind: string;
  readonly meta: string;
  /** The release on GitHub; none for work not released yet. */
  readonly url: string | null;
  readonly notes: ReleaseNotes | null;
  readonly notesHeading: string;
  readonly groups: readonly PullGroup[];
}

const NOTES_HEADING: Readonly<Record<ReleaseNotes['source'], string>> = {
  changelog: 'From CHANGELOG.md',
  release: 'Release notes',
};

const rowOf = (pull: ShippedPull): PullRow => ({
  number: pull.number,
  title: pull.title,
  url: pull.url,
  merged: dateWords(pull.mergedAt),
  author: pull.author,
});

const notesHeading = (notes: ReleaseNotes | null): string =>
  notes ? NOTES_HEADING[notes.source] : '';

function releaseDetail({ release, bump }: TimelineRelease): ReleaseDetail {
  return {
    key: release.tag,
    title: release.tag,
    kind: release.isPrerelease ? 'Prerelease' : BUMP_WORDS[bump],
    meta: `${dateWords(release.publishedAt)} · ${mergedWords(release.pulls.length)}`,
    url: release.url,
    notes: release.notes,
    notesHeading: notesHeading(release.notes),
    groups: release.pulls.length
      ? [{ key: release.tag, heading: null, rows: release.pulls.map(rowOf) }]
      : [],
  };
}

function unreleasedDetail(work: UnreleasedWork): ReleaseDetail {
  return {
    key: UNRELEASED_KEY,
    title: 'Unreleased',
    kind: 'Not in a release yet',
    meta: mergedWords(work.pulls.length),
    url: null,
    notes: work.notes,
    notesHeading: notesHeading(work.notes),
    groups: [...work.weeks].reverse().map((week) => ({
      key: week.key,
      heading: `${weekWords(week.start)} · ${week.pulls.length}`,
      rows: week.pulls.map(rowOf),
    })),
  };
}

/** The panel's view of `key` in `timeline`, or null when it names nothing there. */
export function detailOf(timeline: ReleaseTimeline, key: string | null): ReleaseDetail | null {
  if (key === UNRELEASED_KEY) {
    return timeline.unreleased ? unreleasedDetail(timeline.unreleased) : null;
  }
  const entry = timeline.releases.find(({ release }) => release.tag === key);
  return entry ? releaseDetail(entry) : null;
}

/** What to show first: the work since the last release, else the newest release. */
export function firstPick(timeline: ReleaseTimeline): string | null {
  if (timeline.unreleased?.pulls.length) return UNRELEASED_KEY;
  return timeline.releases.at(-1)?.release.tag ?? (timeline.unreleased ? UNRELEASED_KEY : null);
}
