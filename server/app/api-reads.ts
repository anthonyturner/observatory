import { actionsReport, ciHealthReport, runJobsReport } from '../actions/actions-report.ts';
import type { ActionsReport, CiHealth, RunJobsReport } from '../actions/actions-types.ts';
import { type AgentsReport, type Handoff, reportCards } from '../agents/agents-report.ts';
import type { CollisionsReport } from '../collisions/collisions-report.ts';
import type { PullState } from '../github/fate-reader.ts';
import type { GitHub } from '../github/github.ts';
import type { RawLabel } from '../github/pull-reader.ts';
import type { Frame } from '../history/frames.ts';
import type { HistoryStore } from '../history/history-store.ts';
import { type Ledger, ledgerReport } from '../history/ledger.ts';
import { type JournalReport, journalReport } from '../journal/journal-report.ts';
import { libraryReport } from '../library/library-report.ts';
import type { LibraryReport } from '../library/library-types.ts';
import { inboxReport } from '../inbox/inbox-report.ts';
import {
  deploymentsReport,
  isPreviewUnsettled,
  isReportBuilding,
  pullPreview,
} from '../deployments/deployments-report.ts';
import { liveSitesReport } from '../deployments/live-site.ts';
import type {
  DeploymentsReport,
  LiveSitesReport,
  PullPreview,
} from '../deployments/deployments-types.ts';
import { insightsReport, isCounting } from '../insights/insights-report.ts';
import { milestonesReport } from '../milestones/milestones-report.ts';
import type { MilestonesReport } from '../milestones/milestones-types.ts';
import type { InsightsReport } from '../insights/insights-types.ts';
import type { InboxReport } from '../inbox/inbox-types.ts';
import type { ReleasesReport } from '../releases/release-types.ts';
import { releasesReport } from '../releases/releases-report.ts';
import { securityReport } from '../security/security-report.ts';
import type { SecurityReport } from '../security/security-types.ts';
import { recordFrame } from '../history/record-frame.ts';
import { type IssueDetail, issueDetail } from '../issues/issue-detail.ts';
import { type IssuesReport, issuesReport } from '../issues/issues-report.ts';
import type { LogSnapshot, LogsUnconfigured } from '../logs/log-types.ts';
import type { ProjectsReport } from '../projects/project-types.ts';
import { projectsReport } from '../projects/projects-report.ts';
import { type CommitDiff, commitDiffOf } from '../queue/commit-diff.ts';
import { type PullDetail, pullDetailOf } from '../queue/pull-detail.ts';
import {
  type PullWeather,
  type WeatherReport,
  pullWeatherOf,
  weatherReport,
} from '../queue/pull-weather.ts';
import { type QueueReport, queueReport } from '../queue/queue-report.ts';
import {
  type SinceLook,
  type SinceLookDiff,
  sinceLookDiffOf,
  sinceLookOf,
} from '../queue/since-look.ts';
import type { UsageReport } from '../usage/usage-types.ts';
import type { AgentUsageReport } from '../agents/agent-usage-report.ts';
import { cachedByKey, keyedCache } from '../util/cached-by-key.ts';

/** GitHub is read at most this often; the page asks every few minutes. */
const PROJECTS_TTL_MS = 5 * 60_000;
/** A queue is looked at closely, so it is read more often. */
const QUEUE_TTL_MS = 2 * 60_000;
/** One pull request is read when it is opened, and again a minute later at most. */
const PULL_TTL_MS = 60_000;
/** A pull request's red flags are read at its head commit, so they hold until a push; the limit
 *  only lets a moved base show. One that could not be read is asked again sooner. */
const WEATHER_TTL_MS = 30 * 60_000;
const UNSCANNED_TTL_MS = 10 * 60_000;
/** A commit never changes; the limit only keeps the cache from holding every one ever opened. */
const COMMIT_TTL_MS = 10 * 60_000;
/** A repository's labels change rarely; the Edit tab offers them. */
const LABELS_TTL_MS = 5 * 60_000;
/** Merging every pair in a clone takes a while: at most every ten minutes. */
const COLLISIONS_TTL_MS = 10 * 60_000;
/** A log folder can hold hundreds of thousands of lines: read it every five minutes at most. */
const LOGS_TTL_MS = 5 * 60_000;
/** Report cards move as pull requests merge: every five minutes at most. */
const AGENTS_TTL_MS = 5 * 60_000;
/** The ledger moves a day at a time; ten minutes is fresh enough. */
const LEDGER_TTL_MS = 10 * 60_000;
/** Releases are cut rarely and merges land a few times a day: ten minutes is fresh enough. */
const RELEASES_TTL_MS = 10 * 60_000;
/** A self-review is posted a few times a day at most; reading the journal costs ten requests. */
const JOURNAL_TTL_MS = 10 * 60_000;
/** A wiki or docs folder changes a few times a day at most; each read costs a request per page. */
const LIBRARY_TTL_MS = 10 * 60_000;
/** Runs start and end every few minutes while work is going on. */
const ACTIONS_TTL_MS = 2 * 60_000;
/** A run's jobs, while it is open on screen; a finished one changes only on a rerun. */
const RUN_JOBS_TTL_MS = 60_000;
/** Each Home card asks for its project's; as often as the projects themselves. */
const CI_HEALTH_TTL_MS = 5 * 60_000;
/** Alerts open and close as dependencies and code change: a few times a day at most. Every
 *  project's tab strip asks for the count, so it is kept as long as the projects. */
const SECURITY_TTL_MS = 5 * 60_000;
/** Commit counts move a few times a day and traffic once a day. While GitHub is still counting
 *  a repository's statistics it is asked again soon, so the screen fills in when they are ready. */
const INSIGHTS_TTL_MS = 10 * 60_000;
const COUNTING_TTL_MS = 20_000;
/** Deploys land a few times a day; one still building is asked about again soon, so it
 *  turns green or red on screen within a poll or two of finishing. */
const DEPLOYMENTS_TTL_MS = 2 * 60_000;
const BUILDING_TTL_MS = 20_000;
/** A production site moves rarely, and finding every project's costs a few requests apiece. */
const LIVE_SITES_TTL_MS = 30 * 60_000;
/** Milestones and discussions move a few times a day. Every project's tab strip asks whether
 *  there are any, so it is kept as long as the projects. */
const MILESTONES_TTL_MS = 5 * 60_000;
/** GitHub asks that notifications be polled no more than once a minute (`X-Poll-Interval`). */
const INBOX_TTL_MS = 60_000;

/** The projects report's one key in its cache. */
const ALL_PROJECTS = 'all';
/** The live sites' one key in their cache. */
const ALL_LIVE_SITES = 'all';
/** The inbox's one key in its cache: there is one account's. */
const ONE_INBOX = 'inbox';

/** Where the reports come from: the same code here and hosted, with different sources. */
export interface ReadSources {
  readonly github: GitHub;
  readonly history: HistoryStore;
  /** Which open pull requests would conflict with each other. */
  readonly collisions: (repo: string) => Promise<CollisionsReport>;
  /** Claude Code usage, or null where none has been read (hosted, before a push). */
  readonly usage: () => Promise<UsageReport | null>;
  /** Each subagent run's tokens and context, or null where the session logs are not on this machine. */
  readonly agentUsage: () => Promise<AgentUsageReport | null>;
  /** An app's log folder, folded, for the Log Sky. */
  readonly logs: (repo: string) => Promise<LogSnapshot | LogsUnconfigured>;
  /** Every agent handoff the capture hook recorded; none where nothing records them. */
  readonly handoffs: () => Promise<readonly Handoff[]>;
}

/** What `GET /api/history` returns. */
export interface HistoryReport {
  readonly repo: string;
  readonly frames: readonly Frame[];
}

/** Every report the API answers with, each read no more often than it needs. */
export interface ApiReads {
  projects(): Promise<ProjectsReport>;
  /** The next read of the projects goes to GitHub, not the cache. */
  forgetProjects(): void;
  /** Also records a frame of the star map's memory when one is due. */
  queue(repo: string): Promise<QueueReport>;
  /** The next read of this queue goes to GitHub, not the cache. */
  forgetQueue(repo: string): void;
  issues(repo: string): Promise<IssuesReport>;
  /** The next read of these issues goes to GitHub, not the cache. */
  forgetIssues(repo: string): void;
  /** One issue with its description, for the issue window. */
  issue(repo: string, number: number): Promise<IssueDetail>;
  /** The next read of this issue goes to GitHub, not the cache. */
  forgetIssue(repo: string, number: number): void;
  pull(repo: string, number: number): Promise<PullDetail>;
  /** The next read of this pull request goes to GitHub, not the cache. */
  forgetPull(repo: string, number: number): void;
  /** Every open pull request's design red flags, each diff read once per head commit. */
  weather(repo: string): Promise<WeatherReport>;
  /** One commit's diff, for the PR screen's Commits tab. */
  commit(repo: string, sha: string): Promise<CommitDiff>;
  /** What changed on a pull request between the head looked at and the head now. */
  sinceLook(repo: string, base: string, head: string): Promise<SinceLook>;
  /** The same, with the diff between the two heads, for the PR screen's Diff tab. */
  sinceLookDiff(repo: string, base: string, head: string): Promise<SinceLookDiff>;
  /** Whether one pull request is open, merged or closed, and its title. */
  pullState(repo: string, number: number): Promise<PullState>;
  labels(repo: string): Promise<RawLabel[]>;
  collisions(repo: string): Promise<CollisionsReport>;
  history(repo: string): Promise<HistoryReport>;
  /** Openings, merges and closures a day for sixty days, rebuilt from GitHub. */
  ledger(repo: string): Promise<Ledger>;
  /** Releases or tags, each with its notes and the merged pull requests it shipped. */
  releases(repo: string): Promise<ReleasesReport>;
  /** What each self-review taught: the Second draft sections of the pull requests' review comments. */
  journal(repo: string): Promise<JournalReport>;
  /** The wiki's pages, or the README and docs where there is no wiki. */
  library(repo: string): Promise<LibraryReport>;
  /** Workflows and their newest runs, with flaky runs tagged and the default branch's health. */
  actions(repo: string): Promise<ActionsReport>;
  /** The next read of these runs, and of the branch's health, goes to GitHub. */
  forgetActions(repo: string): void;
  /** One run's jobs and steps. */
  runJobs(repo: string, runId: number): Promise<RunJobsReport>;
  /** The default branch's CI, for a project card. */
  ciHealth(repo: string): Promise<CiHealth>;
  /** Open Dependabot, code-scanning and secret-scanning alerts, most severe first. */
  security(repo: string): Promise<SecurityReport>;
  /** Weekly commits, contributors, finished pull requests and traffic over the last twelve weeks. */
  insights(repo: string): Promise<InsightsReport>;
  /** The next read of these insights goes to GitHub, not the cache. */
  forgetInsights(repo: string): void;
  /** Each environment with its latest deployments and how they went. */
  deployments(repo: string): Promise<DeploymentsReport>;
  /** The next read of these deployments goes to GitHub, not the cache. */
  forgetDeployments(repo: string): void;
  /** What one commit, a pull request's head, was deployed as. */
  pullPreview(repo: string, sha: string): Promise<PullPreview>;
  /** The production site of every project that has one, read together. */
  liveSites(): Promise<LiveSitesReport>;
  /** Open and lately closed milestones with their progress, and the latest discussions. */
  milestones(repo: string): Promise<MilestonesReport>;
  /** The next read of these milestones and discussions goes to GitHub, not the cache. */
  forgetMilestones(repo: string): void;
  /** The account's unread GitHub notifications across every repository. */
  inbox(): Promise<InboxReport>;
  /** The next read of the inbox goes to GitHub, not the cache. */
  forgetInbox(): void;
  usage(): Promise<UsageReport | null>;
  agentUsage(): Promise<AgentUsageReport | null>;
  logs(repo: string): Promise<LogSnapshot | LogsUnconfigured>;
  /** One report card per agent, from the handoffs and the pull requests they opened. */
  agents(repo: string): Promise<AgentsReport>;
}

export function cachedReads(sources: ReadSources): ApiReads {
  const { github, history } = sources;
  // Each read from GitHub may add a frame to the star map's memory. A failure to
  // record is logged, never passed on: the queue itself was read.
  const queueOf = keyedCache(async (repo) => {
    const report = await queueReport(github, repo);
    await recordFrame(report, history, github, Date.now()).catch((error: unknown) =>
      console.error(`Could not record ${repo}'s history:`, error),
    );
    return report;
  }, QUEUE_TTL_MS);
  // One answer for every project, kept under a single key so it can be dropped.
  const projectsOf = keyedCache(() => projectsReport(github), PROJECTS_TTL_MS);
  const issuesOf = keyedCache((repo) => issuesReport(github, repo), QUEUE_TTL_MS);
  const numberKey = (repo: string, number: number): string => `${repo}#${number}`;
  const issueOf = keyedCache(async (key) => {
    const [repo, number] = key.split('#');
    return issueDetail(github, repo, Number(number));
  }, PULL_TTL_MS);
  const pullOf = keyedCache(async (key) => {
    const [repo, number] = key.split('#');
    const [raw, diff] = await Promise.all([
      github.pullDetail(repo, Number(number)),
      // A diff GitHub will not produce, being too large, must not sink the rest of the screen.
      github.pullDiff(repo, Number(number)).catch(() => ''),
    ]);
    return pullDetailOf(raw, { diff, fetchedAt: new Date().toISOString() });
  }, PULL_TTL_MS);
  const weatherAt = keyedCache(
    async (key): Promise<PullWeather> => {
      const [pull, sha] = key.split('@');
      const [repo, number] = pull.split('#');
      return pullWeatherOf(Number(number), sha, (each) =>
        github.pullDiff(repo, each).catch((error: unknown) => {
          // Too large for GitHub to give, most often: the star is shown as not scanned.
          console.error(`Could not read ${repo}#${each}'s diff for its weather:`, error);
          return null;
        }),
      );
    },
    (weather) => (weather.scanned ? WEATHER_TTL_MS : UNSCANNED_TTL_MS),
  );
  const commitKey = (repo: string, sha: string): string => `${repo}@${sha}`;
  const commitOf = keyedCache(async (key) => {
    const [repo, sha] = key.split('@');
    const diff = await github.commitDiff(repo, sha);
    return commitDiffOf(sha, { diff, fetchedAt: new Date().toISOString() });
  }, COMMIT_TTL_MS);
  // Two commits compare the same way forever, so these keep as long as a commit does.
  const headsKey = (repo: string, base: string, head: string): string =>
    `${repo}@${base}...${head}`;
  const headsOf = (key: string): [string, string, string] => {
    const [repo, heads] = key.split('@');
    const [base, head] = heads.split('...');
    return [repo, base, head];
  };
  const sinceLookOfHeads = keyedCache(async (key) => {
    const [repo, base, head] = headsOf(key);
    return sinceLookOf(await github.compare(repo, base, head));
  }, COMMIT_TTL_MS);
  const sinceLookDiffOfHeads = keyedCache(
    async (key) => {
      const [repo, base, head] = headsOf(key);
      const since = await sinceLookOfHeads.read(key);
      const diff =
        since.newCommits === null
          ? ''
          : // Too large for GitHub to give is shown as such, like a pull request's own diff.
            await github.compareDiff(repo, base, head).catch(() => '');
      return sinceLookDiffOf({ base, head, since }, { diff, fetchedAt: new Date().toISOString() });
    },
    // An empty diff may be a failure that passes, so it is asked for again soon.
    (answer) => (answer.diff ? COMMIT_TTL_MS : PULL_TTL_MS),
  );
  const actionsOf = keyedCache((repo) => actionsReport(github, repo), ACTIONS_TTL_MS);
  const ciHealthOf = keyedCache((repo) => ciHealthReport(github, repo), CI_HEALTH_TTL_MS);
  const runJobsOf = keyedCache(async (key) => {
    const [repo, runId] = key.split('#');
    return runJobsReport(github, repo, Number(runId));
  }, RUN_JOBS_TTL_MS);
  const insightsOf = keyedCache(
    (repo) => insightsReport(github, repo),
    (report) => (isCounting(report) ? COUNTING_TTL_MS : INSIGHTS_TTL_MS),
  );
  const deploymentsOf = keyedCache(
    (repo) => deploymentsReport(github, repo),
    (report) => (isReportBuilding(report) ? BUILDING_TTL_MS : DEPLOYMENTS_TTL_MS),
  );
  const previewOf = keyedCache(
    async (key) => {
      const [repo, sha] = key.split('@');
      return pullPreview(github, repo, sha);
    },
    (preview) => (isPreviewUnsettled(preview) ? BUILDING_TTL_MS : DEPLOYMENTS_TTL_MS),
  );
  const liveSitesOf = keyedCache(
    async () =>
      liveSitesReport(
        github,
        (await projectsOf.read(ALL_PROJECTS)).projects.map((project) => project.repo),
      ),
    LIVE_SITES_TTL_MS,
  );
  const milestonesOf = keyedCache((repo) => milestonesReport(github, repo), MILESTONES_TTL_MS);
  const inboxOf = keyedCache(() => inboxReport(github, new Date()), INBOX_TTL_MS);
  const pullStateOf = keyedCache(async (key) => {
    const [repo, number] = key.split('#');
    return github.pullState(repo, Number(number));
  }, PULL_TTL_MS);

  return {
    projects: () => projectsOf.read(ALL_PROJECTS),
    forgetProjects: () => projectsOf.forget(ALL_PROJECTS),
    queue: (repo) => queueOf.read(repo),
    forgetQueue: (repo) => queueOf.forget(repo),
    issues: (repo) => issuesOf.read(repo),
    forgetIssues: (repo) => issuesOf.forget(repo),
    issue: (repo, number) => issueOf.read(numberKey(repo, number)),
    forgetIssue: (repo, number) => issueOf.forget(numberKey(repo, number)),
    pull: (repo, number) => pullOf.read(numberKey(repo, number)),
    forgetPull: (repo, number) => pullOf.forget(numberKey(repo, number)),
    weather: async (repo) =>
      weatherReport(await queueOf.read(repo), (number, sha) =>
        weatherAt.read(`${numberKey(repo, number)}@${sha}`),
      ),
    commit: (repo, sha) => commitOf.read(commitKey(repo, sha)),
    sinceLook: (repo, base, head) => sinceLookOfHeads.read(headsKey(repo, base, head)),
    sinceLookDiff: (repo, base, head) => sinceLookDiffOfHeads.read(headsKey(repo, base, head)),
    pullState: (repo, number) => pullStateOf.read(numberKey(repo, number)),
    labels: cachedByKey((repo) => github.repoLabels(repo), LABELS_TTL_MS),
    collisions: cachedByKey(sources.collisions, COLLISIONS_TTL_MS),
    history: async (repo) => ({ repo, frames: await history.read(repo) }),
    ledger: cachedByKey((repo) => ledgerReport(github, repo), LEDGER_TTL_MS),
    releases: cachedByKey((repo) => releasesReport(github, repo), RELEASES_TTL_MS),
    journal: cachedByKey((repo) => journalReport(github, repo), JOURNAL_TTL_MS),
    library: cachedByKey((repo) => libraryReport(github, repo), LIBRARY_TTL_MS),
    actions: (repo) => actionsOf.read(repo),
    forgetActions: (repo) => {
      actionsOf.forget(repo);
      ciHealthOf.forget(repo);
    },
    runJobs: (repo, runId) => runJobsOf.read(numberKey(repo, runId)),
    ciHealth: (repo) => ciHealthOf.read(repo),
    security: cachedByKey((repo) => securityReport(github, repo), SECURITY_TTL_MS),
    insights: (repo) => insightsOf.read(repo),
    forgetInsights: (repo) => insightsOf.forget(repo),
    deployments: (repo) => deploymentsOf.read(repo),
    forgetDeployments: (repo) => deploymentsOf.forget(repo),
    pullPreview: (repo, sha) => previewOf.read(commitKey(repo, sha)),
    liveSites: () => liveSitesOf.read(ALL_LIVE_SITES),
    milestones: (repo) => milestonesOf.read(repo),
    forgetMilestones: (repo) => milestonesOf.forget(repo),
    inbox: () => inboxOf.read(ONE_INBOX),
    forgetInbox: () => inboxOf.forget(ONE_INBOX),
    usage: sources.usage,
    agentUsage: sources.agentUsage,
    logs: cachedByKey(sources.logs, LOGS_TTL_MS),
    agents: cachedByKey(
      async (repo) => reportCards(await sources.handoffs(), await github.agentPulls(repo), repo),
      AGENTS_TTL_MS,
    ),
  };
}
