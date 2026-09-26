import type { FilesReader } from '../collisions/collisions-report.ts';
import type { FateReader } from './fate-reader.ts';
import type { GitHubReader } from './github-reader.ts';
import type { LedgerReader } from '../history/ledger.ts';
import type { IssueReader } from './issue-reader.ts';
import type { PullReader } from './pull-reader.ts';
import type { PullWriter } from './pull-writer.ts';
import type { QueueReader } from './queue-reader.ts';

/** Every reader the API uses, and the one writer, as one GitHub implementation provides them. */
export type GitHub = GitHubReader &
  QueueReader &
  PullReader &
  PullWriter &
  IssueReader &
  FateReader &
  FilesReader &
  LedgerReader;
