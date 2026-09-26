import type { CollisionsReport } from '../collisions/collisions-report.ts';
import type { GitHub } from '../github/github.ts';
import type { Frame } from '../history/frames.ts';
import type { HistoryStore } from '../history/history-store.ts';
import { recordFrame } from '../history/record-frame.ts';
import { type IssuesReport, issuesReport } from '../issues/issues-report.ts';
import type { ProjectsReport } from '../projects/project-types.ts';
import { projectsReport } from '../projects/projects-report.ts';
import { type PullDetail, pullDetailOf } from '../queue/pull-detail.ts';
import { type QueueReport, queueReport } from '../queue/queue-report.ts';
import type { UsageReport } from '../usage/usage-types.ts';
import { cached } from '../util/cached.ts';
import { cachedByKey } from '../util/cached-by-key.ts';

/** GitHub is read at most this often; the page asks every few minutes. */
const PROJECTS_TTL_MS = 5 * 60_000;
/** A queue is looked at closely, so it is read more often. */
const QUEUE_TTL_MS = 2 * 60_000;
/** One pull request is read when it is opened, and again a minute later at most. */
const PULL_TTL_MS = 60_000;
/** Merging every pair in a clone takes a while: at most every ten minutes. */
const COLLISIONS_TTL_MS = 10 * 60_000;

/** Where the reports come from: the same code here and hosted, with different sources. */
export interface ReadSources {
  readonly github: GitHub;
  readonly history: HistoryStore;
  /** Which open pull requests would conflict with each other. */
  readonly collisions: (repo: string) => Promise<CollisionsReport>;
  /** Claude Code usage, or null where none has been read (hosted, before a push). */
  readonly usage: () => Promise<UsageReport | null>;
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
  collisions(repo: string): Promise<CollisionsReport>;
  history(repo: string): Promise<HistoryReport>;
  usage(): Promise<UsageReport | null>;
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
  const pullOf = cachedByKey(async (key) => {
    const [repo, number] = key.split('#');
    return pullDetailOf(await github.pullDetail(repo, Number(number)));
  }, PULL_TTL_MS);
  return {
    projects: cached(() => projectsReport(github), PROJECTS_TTL_MS),
    queue: queueOf,
    issues: cachedByKey((repo) => issuesReport(github, repo), QUEUE_TTL_MS),
    pull: (repo, number) => pullOf(`${repo}#${number}`),
    collisions: cachedByKey(sources.collisions, COLLISIONS_TTL_MS),
    history: async (repo) => ({ repo, frames: await history.read(repo) }),
    usage: sources.usage,
  };
}
