import type { ChangelogReader } from '../github/changelog-reader.ts';
import type { MergedPull, MergedPullReader } from '../github/merged-pull-reader.ts';
import type { ReleaseMark, ReleaseReader } from '../github/release-reader.ts';
import { UNRELEASED_KEY, changelogSections, versionKey } from './changelog.ts';
import type {
  ReleaseEntry,
  ReleaseNotes,
  ReleaseSource,
  ReleasesReport,
  UnreleasedEntry,
} from './release-types.ts';

/** The most releases the screen shows. */
export const RELEASE_LIMIT = 30;

/** Everything the releases report reads from GitHub. */
export type ReleaseSources = ReleaseReader & ChangelogReader & MergedPullReader;

/** Each mark's merged pull requests by tag, and those merged after the newest mark. */
export interface Shipped {
  readonly byTag: ReadonlyMap<string, readonly MergedPull[]>;
  readonly unreleased: readonly MergedPull[];
}

/**
 * Which release shipped each pull request: the first one published at or after
 * it merged. This reads the release dates rather than the commits between
 * tags, which would cost a request per release; a branch released from
 * somewhere other than the default branch can be placed one release late.
 */
export function shippedIn(marks: readonly ReleaseMark[], pulls: readonly MergedPull[]): Shipped {
  const oldestFirst = [...marks].sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  const byTag = new Map<string, MergedPull[]>(marks.map((mark) => [mark.tag, []]));
  const unreleased: MergedPull[] = [];
  for (const pull of pulls) {
    const merged = Date.parse(pull.mergedAt);
    const mark = oldestFirst.find((each) => Date.parse(each.publishedAt) >= merged);
    if (mark) byTag.get(mark.tag)?.push(pull);
    else unreleased.push(pull);
  }
  return { byTag, unreleased };
}

/** The changelog's section for a release, under its tag or its title, else the release's own body. */
export function notesFor(
  mark: ReleaseMark,
  sections: ReadonlyMap<string, string>,
): ReleaseNotes | null {
  const section = sections.get(versionKey(mark.tag)) ?? sections.get(versionKey(mark.name));
  if (section) return { source: 'changelog', markdown: section };
  const body = mark.body.trim();
  return body ? { source: 'release', markdown: body } : null;
}

function unreleasedOf(
  sections: ReadonlyMap<string, string>,
  pulls: readonly MergedPull[],
): UnreleasedEntry {
  const markdown = sections.get(UNRELEASED_KEY);
  return { notes: markdown ? { source: 'changelog', markdown } : null, pulls };
}

/**
 * The releases, newest first, each with its notes and what it shipped. The
 * marks may run one past RELEASE_LIMIT: that one is read only as where the oldest
 * shown release begins, so it does not claim everything merged before it.
 */
export function releaseEntries(
  marks: readonly ReleaseMark[],
  pulls: readonly MergedPull[],
  changelog: string | null,
): { releases: ReleaseEntry[]; unreleased: UnreleasedEntry } {
  const sections = changelogSections(changelog ?? '');
  const shipped = shippedIn(marks, pulls);
  const newestFirst = [...marks].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
  const releases = newestFirst.slice(0, RELEASE_LIMIT).map(
    (mark): ReleaseEntry => ({
      tag: mark.tag,
      name: mark.name,
      publishedAt: mark.publishedAt,
      url: mark.url,
      isPrerelease: mark.isPrerelease,
      notes: notesFor(mark, sections),
      pulls: shipped.byTag.get(mark.tag) ?? [],
    }),
  );
  return { releases, unreleased: unreleasedOf(sections, shipped.unreleased) };
}

/** GitHub releases, or the tags where a repository has never published one. */
async function marksOf(
  github: ReleaseReader,
  repo: string,
): Promise<{ marks: ReleaseMark[]; source: ReleaseSource }> {
  const releases = await github.releases(repo, RELEASE_LIMIT + 1);
  if (releases.length) return { marks: releases, source: 'releases' };
  const tags = await github.tags(repo, RELEASE_LIMIT + 1);
  return { marks: tags, source: tags.length ? 'tags' : 'none' };
}

/** The Releases screen's report, rebuilt from GitHub on every read. */
export async function releasesReport(
  github: ReleaseSources,
  repo: string,
  now = Date.now(),
): Promise<ReleasesReport> {
  const [{ marks, source }, changelog, pulls] = await Promise.all([
    marksOf(github, repo),
    github.changelog(repo),
    github.mergedPulls(repo),
  ]);
  return {
    generatedAt: new Date(now).toISOString(),
    repo,
    source,
    ...releaseEntries(marks, pulls, changelog),
  };
}
