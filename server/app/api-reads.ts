import type { CollisionsReport } from '../collisions/collisions-report.ts';
import type { GitHub } from '../github/github.ts';
import type { RawLabel } from '../github/pull-reader.ts';
import type { Frame } from '../history/frames.ts';
import type { HistoryStore } from '../history/history-store.ts';
import { recordFrame } from '../history/record-frame.ts';
import { type IssuesReport, issuesReport } from '../issues/issues-report.ts';
import type { LogSnapshot, LogsUnconfigured } from '../logs/log-types.ts';
import type { ProjectsReport } from '../projects/project-types.ts';
import { projectsReport } from '../projects/projects-report.ts';
import { type PullDetail, pullDetailOf } from '../queue/pull-detail.ts';
import { type QueueReport, queueReport } from '../queue/queue-report.ts';
import type { UsageReport } from '../usage/usage-types.ts';
import { cached } from '../util/cached.ts';
import { cachedByKey, keyedCache } from '../util/cached-by-key.ts';

/** GitHub is read at most this often; the page asks every few minutes. */
const PROJECTS_TTL_MS = 5 * 60_000;
/** A queue is looked at closely, so it is read more often. */
const QUEUE_TTL_MS = 2 * 60_000;
/** One pull request is read when it is opened, and again a minute later at most. */
const PULL_TTL_MS = 60_000;
/** A repository's labels change rarely; the Edit tab offers them. */
const LABELS_TTL_MS = 5 * 60_000;
/** Merging every pair in a clone takes a while: at most every ten minutes. */
const COLLISIONS_TTL_MS = 10 * 60_000;
/** A log folder can hold hundreds of thousands of lines: read it every five minutes at most. */
const LOGS_TTL_MS = 5 * 60_000;

/** Where the reports come from: the same code here and hosted, with different sources. */
export interface ReadSources {
  readonly github: GitHub;
  readonly history: HistoryStore;
  /** Which open pull requests would conflict with each other. */
  readonly collisions: (repo: string) => Promise<CollisionsReport>;
  /** Claude Code usage, or null where none has been read (hosted, before a push). */
  readonly usage: () => Promise<UsageReport | null>;
  /** An app's log folder, folded, for the Log Sky. */
  readonly logs: (repo: string) => Promise<LogSnapshot | LogsUnconfigured>;
}

/** What `GET /api/history` returns. */
export interface HistoryReport {
  readonly repo: string;
  readonly frames: readonly Frame[];
}

/** Every report the API answers with, each read no more often than it needs. */
export interface ApiReads {
  projects(): Promise<ProjectsReport>;
  /** Also records a frame of the star map's memory when one is due. */
  queue(repo: string): Promise<QueueReport>;
  issues(repo: string): Promise<IssuesReport>;
  pull(repo: string, number: number): Promise<PullDetail>;
  /** The next read of this pull request goes to GitHub, not the cache. */
  forgetPull(repo: string, number: number): void;
  labels(repo: string): Promise<RawLabel[]>;
  collisions(repo: string): Promise<CollisionsReport>;
  history(repo: string): Promise<HistoryReport>;
  usage(): Promise<UsageReport | null>;
  logs(repo: string): Promise<LogSnapshot | LogsUnconfigured>;
}

export function cachedReads(sources: ReadSources): ApiReads {
  const { github, history } = sources;
  // Each read from GitHub may add a frame to the star map's memory. A failure to
  // record is logged, never passed on: the queue itself was read.
  const queueOf = cachedByKey(async (repo) => {
    const report = await queueReport(github, repo);
    await recordFrame(report, history, github, Date.now()).catch((error: unknown) =>
      console.error(`Could not record ${repo}'s history:`, error),
    );
    return report;
  }, QUEUE_TTL_MS);
  const pullOf = keyedCache(async (key) => {
    const [repo, number] = key.split('#');
    const [raw, diff] = await Promise.all([
      github.pullDetail(repo, Number(number)),
      // A diff GitHub will not produce, being too large, must not sink the rest of the screen.
      github.pullDiff(repo, Number(number)).catch(() => ''),
    ]);
    return pullDetailOf(raw, { diff, fetchedAt: new Date().toISOString() });
  }, PULL_TTL_MS);
  const pullKey = (repo: string, number: number): string => `${repo}#${number}`;
  return {
    projects: cached(() => projectsReport(github), PROJECTS_TTL_MS),
    queue: queueOf,
    issues: cachedByKey((repo) => issuesReport(github, repo), QUEUE_TTL_MS),
    pull: (repo, number) => pullOf.read(pullKey(repo, number)),
    forgetPull: (repo, number) => pullOf.forget(pullKey(repo, number)),
    labels: cachedByKey((repo) => github.repoLabels(repo), LABELS_TTL_MS),
    collisions: cachedByKey(sources.collisions, COLLISIONS_TTL_MS),
    history: async (repo) => ({ repo, frames: await history.read(repo) }),
    usage: sources.usage,
    logs: cachedByKey(sources.logs, LOGS_TTL_MS),
  };
}
