import type { FilesReader } from '../collisions/collisions-report.ts';
import type { ActionsReader } from './actions-reader.ts';
import type { CheckHistoryReader } from './check-history.ts';
import type { ChangelogReader } from './changelog-reader.ts';
import type { CheckRerunner } from './check-rerunner.ts';
import type { PullCommentReader } from './comment-reader.ts';
import type { CommitReader } from './commit-reader.ts';
import type { CompareReader } from './compare-reader.ts';
import type { DeploymentReader } from './deployment-reader.ts';
import type { DocsReader } from './docs-reader.ts';
import type { FateReader } from './fate-reader.ts';
import type { GitHubReader } from './github-reader.ts';
import type { InboxMarker } from './inbox-marker.ts';
import type { InsightsReader } from './insights-reader.ts';
import type { AgentReader } from '../agents/agents-report.ts';
import type { LedgerReader } from '../history/ledger.ts';
import type { IssueDetailReader, IssueReader } from './issue-reader.ts';
import type { MergedPullReader } from './merged-pull-reader.ts';
import type { NotificationReader } from './notification-reader.ts';
import type { PullReader } from './pull-reader.ts';
import type { PullWriter } from './pull-writer.ts';
import type { QueueReader } from './queue-reader.ts';
import type { ReleaseReader } from './release-reader.ts';
import type { SecurityReader } from './security-reader.ts';
import type { WikiReader } from './wiki-reader.ts';

/** Every reader the API uses, and the writers, as one GitHub implementation provides them. */
export type GitHub = GitHubReader &
  QueueReader &
  PullReader &
  CommitReader &
  CompareReader &
  PullWriter &
  IssueReader &
  IssueDetailReader &
  FateReader &
  FilesReader &
  LedgerReader &
  AgentReader &
  CheckHistoryReader &
  CheckRerunner &
  ReleaseReader &
  ChangelogReader &
  PullCommentReader &
  MergedPullReader &
  ActionsReader &
  DocsReader &
  WikiReader &
  SecurityReader &
  NotificationReader &
  InsightsReader &
  DeploymentReader &
  InboxMarker;
