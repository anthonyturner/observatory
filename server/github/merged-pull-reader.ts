import { type Json, type JsonGet, isJson, isText, jsonList } from './rest-json.ts';

/** A merged pull request, as the Releases screen lists what each release shipped. */
export interface MergedPull {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly mergedAt: string;
  /** The login that opened it; empty when GitHub no longer knows the account. */
  readonly author: string;
}

/** What the Releases screen reads of a repository's merged pull requests, and nothing else. */
export interface MergedPullReader {
  /** Merged pull requests, most recently merged first, up to MERGED_LIMIT. */
  mergedPulls(repo: string): Promise<MergedPull[]>;
}

/** Enough for months of a busy repository; each hundred costs one request. */
export const MERGED_LIMIT = 500;
const PAGE_SIZE = 100;

function mergedPullOf(pull: Json): MergedPull | null {
  const { number, title, html_url: url, merged_at: mergedAt, user } = pull;
  if (!Number.isInteger(number) || !isText(title) || !isText(url) || !isText(mergedAt)) {
    return null;
  }
  const login = isJson(user) ? user['login'] : null;
  return { number: Number(number), title, url, mergedAt, author: isText(login) ? login : '' };
}

/** The merged ones in a `GET /pulls?state=closed` answer, which lists closed-unmerged ones too. */
export function mergedPullsOf(body: unknown): MergedPull[] {
  return jsonList(body)
    .map(mergedPullOf)
    .filter((pull) => pull !== null);
}

const byMergeNewestFirst = (a: MergedPull, b: MergedPull): number =>
  Date.parse(b.mergedAt) - Date.parse(a.mergedAt);

/**
 * Closed pull requests a page at a time, most recently updated first, which
 * puts recent merges first. A short page is the last one.
 */
export async function readMergedPulls(get: JsonGet, repo: string): Promise<MergedPull[]> {
  const merged: MergedPull[] = [];
  for (let page = 1; page * PAGE_SIZE <= MERGED_LIMIT; page++) {
    const body = await get(
      `repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=${PAGE_SIZE}&page=${page}`,
    );
    merged.push(...mergedPullsOf(body));
    if (jsonList(body).length < PAGE_SIZE) break;
  }
  return merged.sort(byMergeNewestFirst).slice(0, MERGED_LIMIT);
}
