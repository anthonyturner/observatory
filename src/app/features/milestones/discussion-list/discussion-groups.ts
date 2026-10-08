import { DiscussionThread } from '../../../core/milestones/milestones-report';
import { plural } from '../../../shared/text/plural';
import { agoWords } from '../../actions/actions-words';

/** One discussion as a row of its category. */
export interface ThreadRow {
  readonly key: string;
  readonly title: string;
  readonly url: string;
  /** "Answered" or "Unanswered" where its category takes an answer; null where it does not. */
  readonly answer: string | null;
  readonly isAnswered: boolean;
  /** "3 comments · by ann · 3h ago". */
  readonly meta: string;
}

/** One category's discussions, most recently active first. */
export interface CategoryGroup {
  readonly name: string;
  readonly rows: readonly ThreadRow[];
}

function answerWords(thread: DiscussionThread): string | null {
  if (!thread.isAnswerable) return null;
  return thread.isAnswered ? 'Answered' : 'Unanswered';
}

function threadRow(thread: DiscussionThread, now: number): ThreadRow {
  const by = thread.author ? [`by ${thread.author}`] : [];
  return {
    key: String(thread.number),
    title: thread.title,
    url: thread.url,
    answer: answerWords(thread),
    isAnswered: thread.isAnswered,
    meta: [plural(thread.comments, 'comment'), ...by, agoWords(thread.updatedAt, now)].join(' · '),
  };
}

/**
 * The discussions by category, `now` being when the report was made. They
 * come most recently active first, so the busiest category lately leads.
 */
export function discussionGroups(
  threads: readonly DiscussionThread[],
  now: number,
): CategoryGroup[] {
  const byCategory = new Map<string, ThreadRow[]>();
  for (const thread of threads) {
    const rows = byCategory.get(thread.category) ?? [];
    rows.push(threadRow(thread, now));
    byCategory.set(thread.category, rows);
  }
  return [...byCategory].map(([name, rows]) => ({ name, rows }));
}
