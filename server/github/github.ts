import type { FilesReader } from '../collisions/collisions-report.ts';
import type { CommitReader } from './commit-reader.ts';
import type { CompareReader } from './compare-reader.ts';
import type { FateReader } from './fate-reader.ts';
import type { GitHubReader } from './github-reader.ts';
import type { AgentReader } from '../agents/agents-report.ts';
import type { LedgerReader } from '../history/ledger.ts';
import type { IssueDetailReader, IssueReader } from './issue-reader.ts';
import type { PullReader } from './pull-reader.ts';
import type { PullWriter } from './pull-writer.ts';
import type { QueueReader } from './queue-reader.ts';

/** Every reader the API uses, and the one writer, as one GitHub implementation provides them. */
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
  AgentReader;
