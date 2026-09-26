import type { FilesReader } from '../collisions/collisions-report.ts';
import type { FateReader } from './fate-reader.ts';
import type { GitHubReader } from './github-reader.ts';
import type { LedgerReader } from '../history/ledger.ts';
import type { IssueDetailReader, IssueReader } from './issue-reader.ts';
import type { PullReader } from './pull-reader.ts';
import type { QueueReader } from './queue-reader.ts';

/** Every reader the API uses, as one GitHub implementation provides them. */
export type GitHub = GitHubReader &
  QueueReader &
  PullReader &
  IssueReader &
  IssueDetailReader &
  FateReader &
  FilesReader &
  LedgerReader;
