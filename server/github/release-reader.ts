import { type Json, type JsonGet, isJson, isText, jsonList } from './rest-json.ts';

/** A point a repository shipped from: a published GitHub release, or a bare tag. */
export interface ReleaseMark {
  readonly tag: string;
  /** The release's title; a bare tag's name. */
  readonly name: string;
  readonly publishedAt: string;
  readonly url: string;
  readonly isPrerelease: boolean;
  /** The release's own notes, as markdown; empty for a bare tag. */
  readonly body: string;
}

/** What the Releases screen reads of a repository's releases and tags, and nothing else. */
export interface ReleaseReader {
  /** Published releases, newest first, up to `limit`; drafts are left out. */
  releases(repo: string, limit: number): Promise<ReleaseMark[]>;
  /** Tags, dated by the commit each points at, newest first, up to `limit`. */
  tags(repo: string, limit: number): Promise<ReleaseMark[]>;
}

/** One request's worth: GitHub lists at most a hundred a page. */
const MAX_PAGE = 100;

const newestFirst = (marks: readonly ReleaseMark[]): ReleaseMark[] =>
  [...marks].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

function releaseOf(release: Json): ReleaseMark | null {
  const { tag_name: tag, name, published_at: publishedAt, html_url: url, body } = release;
  if (release['draft'] === true || !isText(tag) || !isText(publishedAt) || !isText(url)) {
    return null;
  }
  return {
    tag,
    name: isText(name) ? name : tag,
    publishedAt,
    url,
    isPrerelease: release['prerelease'] === true,
    body: typeof body === 'string' ? body : '',
  };
}

/** The published releases in a `GET /releases` answer, newest first. */
export function releasesOf(body: unknown): ReleaseMark[] {
  return newestFirst(
    jsonList(body)
      .map(releaseOf)
      .filter((mark) => mark !== null),
  );
}

/** Each tag's name and the commit it points at, from a `GET /tags` answer. */
export function taggedCommitsOf(body: unknown): { name: string; sha: string }[] {
  return jsonList(body).flatMap((tag) => {
    const commit = tag['commit'];
    const sha = isJson(commit) ? commit['sha'] : null;
    return isText(tag['name']) && isText(sha) ? [{ name: tag['name'], sha }] : [];
  });
}

/** When a commit was made, from a `GET /commits/{sha}` answer, or null. */
export function commitDateOf(body: unknown): string | null {
  const commit = isJson(body) ? body['commit'] : null;
  const committer = isJson(commit) ? commit['committer'] : null;
  const date = isJson(committer) ? committer['date'] : null;
  return isText(date) ? date : null;
}

export async function readReleases(
  get: JsonGet,
  repo: string,
  limit: number,
): Promise<ReleaseMark[]> {
  const perPage = Math.min(limit, MAX_PAGE);
  return releasesOf(await get(`repos/${repo}/releases?per_page=${perPage}`)).slice(0, limit);
}

/** A tag carries no date of its own, so each costs one more request for its commit's. */
export async function readTags(get: JsonGet, repo: string, limit: number): Promise<ReleaseMark[]> {
  const perPage = Math.min(limit, MAX_PAGE);
  const tagged = taggedCommitsOf(await get(`repos/${repo}/tags?per_page=${perPage}`)).slice(
    0,
    limit,
  );
  const dated = await Promise.all(
    tagged.map(async ({ name, sha }): Promise<ReleaseMark | null> => {
      const publishedAt = commitDateOf(await get(`repos/${repo}/commits/${sha}`));
      if (!publishedAt) return null;
      const url = `https://github.com/${repo}/tree/${encodeURIComponent(name)}`;
      return { tag: name, name, publishedAt, url, isPrerelease: false, body: '' };
    }),
  );
  return newestFirst(dated.filter((mark) => mark !== null));
}
