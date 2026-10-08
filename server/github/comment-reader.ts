import { type Json, type JsonGet, isText, jsonList } from './rest-json.ts';

/** A comment on a pull request, as the Journal reads self-reviews. */
export interface PullComment {
  readonly pull: number;
  /** The comment's own page on GitHub. */
  readonly url: string;
  /** ISO time the comment was posted. */
  readonly postedAt: string;
  readonly body: string;
}

/** What the Journal reads of a repository's pull-request comments, and nothing else. */
export interface PullCommentReader {
  /** Pull-request comments from people who work on the repository, newest first, up to COMMENT_LIMIT comments looked at. */
  pullComments(repo: string): Promise<PullComment[]>;
}

/** A hundred a request: a thousand comments reach back through a few hundred reviewed pull requests. */
export const COMMENT_LIMIT = 1000;
const PAGE_SIZE = 100;

/**
 * Only these may write a journal entry: anyone can comment on a public pull
 * request, and a stranger's words must not appear as the owner's lessons.
 */
const TEAM_ASSOCIATIONS: ReadonlySet<string> = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

const ISSUE_URL_NUMBER = /\/issues\/(\d+)$/;
/** An issue comment's page is `/pull/<n>#issuecomment-<id>` when its thread is a pull request. */
const PULL_PAGE = /\/pull\/\d+#/;

function pullCommentOf(comment: Json): PullComment | null {
  const { issue_url: issueUrl, html_url: url, created_at: postedAt, body } = comment;
  if (!isText(issueUrl) || !isText(url) || !isText(postedAt) || !isText(body)) return null;
  const number = ISSUE_URL_NUMBER.exec(issueUrl)?.[1];
  const isTeam = TEAM_ASSOCIATIONS.has(String(comment['author_association']));
  const isDated = Number.isFinite(Date.parse(postedAt));
  if (number === undefined || !PULL_PAGE.test(url) || !isTeam || !isDated) return null;
  return { pull: Number(number), url, postedAt, body };
}

/** The team's comments on pull requests in a `GET /issues/comments` answer, which lists issue comments too. */
export function pullCommentsOf(body: unknown): PullComment[] {
  return jsonList(body)
    .map(pullCommentOf)
    .filter((comment) => comment !== null);
}

/** The repository's comments a page at a time, newest first; a short page is the last one. */
export async function readPullComments(get: JsonGet, repo: string): Promise<PullComment[]> {
  const comments: PullComment[] = [];
  for (let page = 1; (page - 1) * PAGE_SIZE < COMMENT_LIMIT; page++) {
    const body = await get(
      `repos/${repo}/issues/comments?sort=created&direction=desc&per_page=${PAGE_SIZE}&page=${page}`,
    );
    comments.push(...pullCommentsOf(body));
    if (jsonList(body).length < PAGE_SIZE) break;
  }
  return comments;
}
