import type { PullComment, PullCommentReader } from '../github/comment-reader.ts';
import { type SecondDraft, secondDraftsIn } from './second-draft.ts';

/** One lesson, and the review comment on the pull request that holds it. */
export interface JournalEntry extends SecondDraft {
  readonly pull: number;
  /** The review comment's page on GitHub. */
  readonly url: string;
  /** ISO time the comment was posted. */
  readonly postedAt: string;
}

/** What `GET /api/journal` returns. */
export interface JournalReport {
  readonly generatedAt: string;
  readonly repo: string;
  /** Newest comment first; the lessons in one comment stay in the order they were written. */
  readonly entries: readonly JournalEntry[];
}

const byPostedNewestFirst = (a: PullComment, b: PullComment): number =>
  Date.parse(b.postedAt) - Date.parse(a.postedAt);

/** The lessons in `comments`, newest comment first. A comment with no Second draft section adds none. */
export function journalEntries(comments: readonly PullComment[]): JournalEntry[] {
  return [...comments].sort(byPostedNewestFirst).flatMap((comment) =>
    secondDraftsIn(comment.body).map(
      (draft): JournalEntry => ({
        ...draft,
        pull: comment.pull,
        url: comment.url,
        postedAt: comment.postedAt,
      }),
    ),
  );
}

/** The Journal screen's report, rebuilt from GitHub on every read. */
export async function journalReport(
  github: PullCommentReader,
  repo: string,
  now = Date.now(),
): Promise<JournalReport> {
  return {
    generatedAt: new Date(now).toISOString(),
    repo,
    entries: journalEntries(await github.pullComments(repo)),
  };
}
