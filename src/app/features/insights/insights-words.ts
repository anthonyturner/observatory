import { InsightsState } from '../../core/insights/insights-feed';
import { InsightsReport } from '../../core/insights/insights-report';
import { plural } from '../../shared/text/plural';
import { PageMessage } from '../releases/releases-page/releases-words';

/* How the Insights screen names its states and empty parts. */

export const NO_COMMITS = 'No commits to the default branch in these weeks.';
export const NO_MERGES = 'Nothing merged in these weeks.';
export const NO_CONTRIBUTORS = 'No one committed to the default branch in these weeks.';
export const NO_AGENTS =
  'No agent handoff claims a pull request finished in these weeks. The Agents report cards record them.';
export const NO_TRAFFIC = 'GitHub gave no traffic for this repository.';
/** Above the sections while GitHub works out the commit or contributor counts in the background. */
export const COUNTING_NOTE =
  'GitHub is still counting this repository’s history, so some charts are not drawn yet.';

/** What to say while there is no report to show, or null once there is one. */
export function stateMessage(state: InsightsState): PageMessage | null {
  switch (state.status) {
    case 'reading':
      return { headline: 'Reading the insights…' };
    case 'missing':
      return { headline: 'No such project', detail: 'It may be private, or the name is wrong.' };
    case 'unreachable':
      return {
        headline: 'Could not read the insights',
        detail: 'GitHub or the API did not answer. Try again in a moment.',
      };
    case 'ready':
      return null;
  }
}

/** "me/app · 365 commits in 12 weeks", or the name alone before a report or its commits. */
export function insightsStamp(repo: string, report: InsightsReport | null): string {
  if (report?.commits.status !== 'read') return repo;
  const total = report.commits.weeks.reduce((sum, week) => sum + week.total, 0);
  return `${repo} · ${plural(total, 'commit')} in ${report.weeks} weeks`;
}
