import type { MergedPull } from '../github/merged-pull-reader.ts';

/** A release's notes: its changelog section where there is one, else the release's own body. */
export interface ReleaseNotes {
  readonly source: 'changelog' | 'release';
  readonly markdown: string;
}

/** One release, with the merged pull requests it shipped, most recently merged first. */
export interface ReleaseEntry {
  readonly tag: string;
  readonly name: string;
  readonly publishedAt: string;
  readonly url: string;
  readonly isPrerelease: boolean;
  readonly notes: ReleaseNotes | null;
  readonly pulls: readonly MergedPull[];
}

/** What merged after the newest release, and the changelog's `[Unreleased]` entries. */
export interface UnreleasedEntry {
  readonly notes: ReleaseNotes | null;
  readonly pulls: readonly MergedPull[];
}

/** Where the releases came from: GitHub releases, bare tags where there are none, or neither. */
export type ReleaseSource = 'releases' | 'tags' | 'none';

/** What `GET /api/releases` returns. */
export interface ReleasesReport {
  readonly generatedAt: string;
  readonly repo: string;
  readonly source: ReleaseSource;
  /** Newest first. */
  readonly releases: readonly ReleaseEntry[];
  readonly unreleased: UnreleasedEntry;
}
