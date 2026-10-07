import { Json, isNumber, isObject, isText, listOf, oneOf } from '../json/json-fields';

/** A merged pull request, as a release lists what it shipped. */
export interface ShippedPull {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  /** Milliseconds since the epoch. */
  readonly mergedAt: number;
  readonly author: string;
}

/** A release's notes: its changelog section, or the release's own body. */
export interface ReleaseNotes {
  readonly source: 'changelog' | 'release';
  readonly markdown: string;
}

export interface Release {
  readonly tag: string;
  readonly name: string;
  readonly publishedAt: number;
  readonly url: string;
  readonly isPrerelease: boolean;
  readonly notes: ReleaseNotes | null;
  /** Most recently merged first. */
  readonly pulls: readonly ShippedPull[];
}

/** What merged after the newest release, and the changelog's `[Unreleased]` entries. */
export interface Unreleased {
  readonly notes: ReleaseNotes | null;
  readonly pulls: readonly ShippedPull[];
}

export type ReleaseSource = 'releases' | 'tags' | 'none';

/** What `GET /api/releases` returns. */
export interface ReleasesReport {
  readonly generatedAt: number;
  readonly repo: string;
  readonly source: ReleaseSource;
  /** Newest first. */
  readonly releases: readonly Release[];
  readonly unreleased: Unreleased;
}

const NOTE_SOURCES = ['changelog', 'release'] as const;
const RELEASE_SOURCES: readonly ReleaseSource[] = ['releases', 'tags', 'none'];
const isNoteSource = oneOf(NOTE_SOURCES);
const isReleaseSource = oneOf(RELEASE_SOURCES);
const HTTPS = /^https:\/\//;

/** A time GitHub gave as ISO text, in milliseconds, or null when it is not one. */
const timeOf = (value: unknown): number | null => {
  const ms = isText(value) ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : null;
};

/** Only a link to GitHub's own site is drawn as one. */
const linkOf = (value: unknown): string | null =>
  isText(value) && HTTPS.test(value) ? value : null;

function parsePull(value: unknown): ShippedPull | null {
  if (!isObject(value)) return null;
  const { number, title, url, author } = value;
  const mergedAt = timeOf(value['mergedAt']);
  const link = linkOf(url);
  if (!isNumber(number) || !isText(title) || !link || mergedAt === null) return null;
  return { number, title, url: link, mergedAt, author: isText(author) ? author : '' };
}

function parseNotes(value: unknown): ReleaseNotes | null {
  if (!isObject(value) || !isNoteSource(value['source']) || !isText(value['markdown'])) {
    return null;
  }
  return { source: value['source'], markdown: value['markdown'] };
}

const pullsIn = (body: Json): ShippedPull[] => listOf(body['pulls'], parsePull);

function parseRelease(value: unknown): Release | null {
  if (!isObject(value)) return null;
  const { tag, name } = value;
  const publishedAt = timeOf(value['publishedAt']);
  const url = linkOf(value['url']);
  if (!isText(tag) || publishedAt === null || !url) return null;
  return {
    tag,
    name: isText(name) ? name : tag,
    publishedAt,
    url,
    isPrerelease: value['isPrerelease'] === true,
    notes: parseNotes(value['notes']),
    pulls: pullsIn(value),
  };
}

/** The report, checked field by field, or null when the answer is not one. */
export function parseReleasesReport(body: unknown): ReleasesReport | null {
  if (!isObject(body) || !isText(body['repo']) || !isReleaseSource(body['source'])) return null;
  const generatedAt = timeOf(body['generatedAt']);
  const unreleased = isObject(body['unreleased']) ? body['unreleased'] : {};
  if (generatedAt === null) return null;
  return {
    generatedAt,
    repo: body['repo'],
    source: body['source'],
    releases: listOf(body['releases'], parseRelease),
    unreleased: { notes: parseNotes(unreleased['notes']), pulls: pullsIn(unreleased) },
  };
}
