import { DepartedPull } from './activity-memory';
import { ActivityItem, ClosedIssue } from './activity.types';

/**
 * One check's news with each closed issue told inside the merged pull request
 * that said it closes it, rather than as an item of its own. The closing
 * references are those the pull request listed while it was open.
 */
export function foldClosings(
  items: readonly ActivityItem[],
  merges: readonly DepartedPull[],
): ActivityItem[] {
  const closed = items.filter((item) => item.kind === 'issue-closed');
  const folded = new Set<ActivityItem>();
  const told = items.map((item) => {
    if (item.kind !== 'merged') return item;
    const closes = closesOf(item, merges);
    const closing = closed.filter(
      (issue) => !folded.has(issue) && issue.repo === item.repo && closes.has(issue.number),
    );
    if (!closing.length) return item;
    for (const issue of closing) folded.add(issue);
    return { ...item, closing: closing.map(closedIssueOf) };
  });
  return told.filter((item) => !folded.has(item));
}

function closesOf(pull: ActivityItem, merges: readonly DepartedPull[]): ReadonlySet<number> {
  const merge = merges.find(({ repo, number }) => repo === pull.repo && number === pull.number);
  return new Set(merge?.closes ?? []);
}

const closedIssueOf = ({ number, title }: ActivityItem): ClosedIssue => ({ number, title });
