import { InboxState } from '../../core/inbox/inbox-feed';
import { InboxReport } from '../../core/inbox/inbox-report';
import { plural } from '../../shared/text/plural';
import { PageMessage } from '../releases/releases-page/releases-words';

/* How the Inbox names GitHub's reasons and subjects, and what it says while there is no list. */

/** How loudly a reason calls: asked of you, said to you, a warning, or just news. */
export type ReasonTone = 'asks' | 'calls' | 'warns' | 'quiet';

interface ReasonWords {
  readonly label: string;
  readonly tone: ReasonTone;
}

/**
 * GitHub's reasons, in the order the Inbox lists them: what waits on you first.
 * The labels follow GitHub's notification docs.
 */
const REASONS: readonly (readonly [string, ReasonWords])[] = [
  ['review_requested', { label: 'Review requested', tone: 'asks' }],
  ['approval_requested', { label: 'Deployment waiting for you', tone: 'asks' }],
  ['assign', { label: 'Assigned to you', tone: 'asks' }],
  ['mention', { label: 'Mentioned you', tone: 'calls' }],
  ['team_mention', { label: 'Mentioned your team', tone: 'calls' }],
  ['invitation', { label: 'Invitation', tone: 'calls' }],
  ['security_alert', { label: 'Security alert', tone: 'warns' }],
  ['ci_activity', { label: 'CI runs', tone: 'warns' }],
  ['author', { label: 'You opened it', tone: 'quiet' }],
  ['comment', { label: 'You commented', tone: 'quiet' }],
  ['state_change', { label: 'You changed its state', tone: 'quiet' }],
  ['your_activity', { label: 'Your activity', tone: 'quiet' }],
  ['manual', { label: 'You subscribed', tone: 'quiet' }],
  ['subscribed', { label: 'Watching the repository', tone: 'quiet' }],
  ['member_feature_requested', { label: 'Feature requested', tone: 'quiet' }],
  ['security_advice_requested', { label: 'Security advice requested', tone: 'quiet' }],
];
const REASON_WORDS = new Map(REASONS);
const REASON_RANK = new Map(REASONS.map(([reason], rank) => [reason, rank]));

/** "some_new_reason" as "Some new reason", for a reason GitHub adds later. */
const sentenceOf = (word: string): string => {
  const spaced = word.replaceAll('_', ' ').trim() || 'Other';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

export const reasonWords = (reason: string): ReasonWords =>
  REASON_WORDS.get(reason) ?? { label: sentenceOf(reason), tone: 'quiet' };

/** Where a reason sits among the others: known ones in REASONS order, any other after. */
export const reasonRank = (reason: string): number => REASON_RANK.get(reason) ?? REASONS.length;

const SUBJECT_WORDS: Readonly<Record<string, string>> = {
  PullRequest: 'Pull request',
  Issue: 'Issue',
  CheckSuite: 'CI run',
  WorkflowRun: 'Workflow run',
  Release: 'Release',
  Discussion: 'Discussion',
  Commit: 'Commit',
  RepositoryVulnerabilityAlert: 'Security alert',
  RepositoryDependabotAlertsThread: 'Dependabot alerts',
};

/** "PullRequest" as "Pull request"; a type GitHub adds later, split at its capitals. */
export function subjectWords(subjectType: string): string {
  const known = SUBJECT_WORDS[subjectType];
  if (known) return known;
  const words = subjectType.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return sentenceOf(words || 'notification');
}

/** What to say while there is no list to show, or null once there is one. */
export function stateMessage(state: InboxState): PageMessage | null {
  switch (state.status) {
    case 'reading':
      return { headline: 'Listening for transmissions…' };
    case 'private':
      return {
        headline: 'The inbox is the owner’s own',
        detail: 'GitHub notifications are private. Sign in as the owner to see them.',
      };
    case 'unreachable':
      return {
        headline: 'Could not read the inbox',
        detail: 'GitHub or the API did not answer. Try again in a moment.',
      };
    case 'ready':
      return null;
  }
}

/** What to say when the list is empty or could not be read; null while there is something unread. */
export function emptyMessage(report: InboxReport): PageMessage | null {
  if (report.status !== 'read') {
    return { headline: 'Could not read your notifications', detail: report.note ?? undefined };
  }
  if (report.items.length) return null;
  return { headline: 'All clear', detail: 'No unread notifications. Nothing is waiting on you.' };
}

/** "12 unread transmissions", or "200+ unread transmissions" when there were more than were read. */
export function inboxStamp(report: InboxReport | null): string {
  if (!report || report.status !== 'read') return 'Incoming transmissions';
  const count = report.items.length;
  return report.isCapped ? `${count}+ unread transmissions` : plural(count, 'unread transmission');
}
