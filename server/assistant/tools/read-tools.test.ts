import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IssueRow, IssuesReport } from '../../issues/issues-report.ts';
import type { ProjectSnapshot } from '../../projects/project-types.ts';
import type { QueueItem } from '../../queue/queue-report.ts';
import type { UsageReport } from '../../usage/usage-types.ts';
import type { ToolContext } from '../agent/agent-tool.ts';
import { MAX_PROJECTS_LISTED, listProjectsTool } from './list-projects.ts';
import { MAX_ISSUES_LISTED, projectIssuesTool } from './project-issues.ts';
import { MAX_PULLS_LISTED, projectPullRequestsTool } from './project-pull-requests.ts';
import { ToolArgError } from './tool-args.ts';
import { usageSummaryTool } from './usage-summary.ts';

const context: ToolContext = {
  projects: [
    { name: 'app', repo: 'me/app', href: '/p/me/app' },
    { name: 'site', repo: 'me/site', href: '/p/me/site' },
  ],
};

const COUNTS = { conflicted: 1, failing: 2, unknown: 0, unlinked: 3, unreviewed: 4, unclaimed: 5 };

const snapshot = (name: string): ProjectSnapshot => ({
  name,
  repo: `me/${name}`,
  dashboardUrl: `/p/me/${name}`,
  open: 10,
  counts: COUNTS,
  issues: 7,
  oldestIdleDays: 12,
  openPulls: [],
  openIssues: [],
});

const item = (number: number): QueueItem => ({
  number,
  title: `Pull ${number}`,
  url: '',
  isDraft: false,
  bucket: 'failing',
  closes: number % 2 ? [3] : [],
  failingChecks: 1,
  additions: 1,
  deletions: 1,
  updatedAt: '',
  branch: '',
  headSha: 'a'.repeat(40),
  base: 'main',
  mergeable: 'MERGEABLE',
  changedFiles: 1,
  idleDays: 4,
  ageDays: 9,
});

const issue = (number: number): IssueRow => ({
  number,
  title: `Issue ${number}`,
  url: '',
  labels: [],
  assignees: [],
  author: 'me',
  createdAt: '',
  updatedAt: '',
  closedAt: null,
  prs: [],
});

describe('list_projects', () => {
  it('lists each project with its counts by bucket, capped', async () => {
    const many = Array.from({ length: MAX_PROJECTS_LISTED + 5 }, (_, at) => snapshot(`p${at}`));
    const tool = listProjectsTool(async () => ({
      generatedAt: '',
      projects: many,
      directives: [],
    }));

    const { content } = await tool.run({}, context);
    const { projects, total } = content as { projects: unknown[]; total: number };

    assert.equal(projects.length, MAX_PROJECTS_LISTED);
    assert.equal(total, MAX_PROJECTS_LISTED + 5);
    assert.deepEqual(projects[0], {
      name: 'p0',
      repo: 'me/p0',
      openPullRequests: 10,
      conflicted: 1,
      failingChecks: 2,
      mergeabilityUnknown: 0,
      noLinkedIssue: 3,
      unreviewed: 4,
      openIssues: 7,
      unclaimedIssues: 5,
      oldestIdleDays: 12,
    });
  });

  it('says why a project could not be read, rather than counting zero', async () => {
    const broken = { ...snapshot('app'), error: 'GitHub timed out' };
    const tool = listProjectsTool(async () => ({
      generatedAt: '',
      projects: [broken],
      directives: [],
    }));

    const { content } = await tool.run({}, context);

    assert.deepEqual((content as { projects: unknown[] }).projects[0], {
      name: 'app',
      repo: 'me/app',
      error: 'GitHub timed out',
    });
  });
});

describe('project_pull_requests', () => {
  it('lists the named project’s queue, capped, with what blocks each', async () => {
    const asked: string[] = [];
    const items = Array.from({ length: MAX_PULLS_LISTED + 1 }, (_, at) => item(at + 1));
    const tool = projectPullRequestsTool(async (repo) => {
      asked.push(repo);
      return { generatedAt: '', repo, items };
    });

    const { content } = await tool.run({ project: 'APP' }, context);
    const { pullRequests, total } = content as { pullRequests: unknown[]; total: number };

    assert.deepEqual(asked, ['me/app']);
    assert.equal(pullRequests.length, MAX_PULLS_LISTED);
    assert.equal(total, MAX_PULLS_LISTED + 1);
    assert.deepEqual(pullRequests[0], {
      number: 1,
      title: 'Pull 1',
      bucket: 'failing',
      idleDays: 4,
      isDraft: false,
      linksIssue: true,
    });
  });

  it('refuses a project that is not on the dashboard, naming those that are', async () => {
    const tool = projectPullRequestsTool(async () => assert.fail('read'));

    await assert.rejects(
      tool.run({ project: 'nope' }, context),
      (error: Error) => error instanceof ToolArgError && /Known: app, site/.test(error.message),
    );
    await assert.rejects(tool.run({}, context), ToolArgError);
  });
});

describe('project_issues', () => {
  it('lists open issues by number and title, capped, finding the project by repository', async () => {
    const open = Array.from({ length: MAX_ISSUES_LISTED + 2 }, (_, at) => issue(at + 1));
    const report: IssuesReport = {
      generatedAt: '',
      repo: 'me/site',
      days: 60,
      total: { open: open.length, closed: 0, comets: 0 },
      open,
      closed: [],
    };
    const tool = projectIssuesTool(async () => report);

    const { content } = await tool.run({ project: 'me/site' }, context);
    const listed = content as { project: string; issues: unknown[]; total: number };

    assert.equal(listed.project, 'site');
    assert.equal(listed.issues.length, MAX_ISSUES_LISTED);
    assert.deepEqual(listed.issues[0], { number: 1, title: 'Issue 1' });
    assert.equal(listed.total, MAX_ISSUES_LISTED + 2);
  });
});

describe('usage_summary', () => {
  it('says when no usage has been read', async () => {
    const { content } = await usageSummaryTool(async () => null).run({}, context);

    assert.deepEqual(content, { error: 'No Claude Code usage has been read here yet.' });
  });

  it('gives the latest day’s tokens and both limits', async () => {
    const day = (name: string, tokens: number) => ({
      day: name,
      families: { sonnet: tokens, haiku: 1 },
      cacheRead: 0,
      messages: 3,
      sessions: 1,
      toolCalls: 0,
      subagents: 0,
    });
    const report = {
      limits: {
        five: { pct: 40, resetsAt: '15:00', expired: false, points: [] },
        week: { pct: 70, resetsAt: 'Mon', expired: true, points: [], startsAt: '' },
      },
      tokens: { rows: [day('2026-09-26', 5), day('2026-09-27', 9)] },
    } as unknown as UsageReport;

    const { content } = await usageSummaryTool(async () => report).run({}, context);

    assert.deepEqual(content, {
      latestDay: { day: '2026-09-27', tokens: 10, messages: 3, sessions: 1 },
      fiveHourLimit: { percentUsed: 40, resetsAt: '15:00', isOutOfDate: false },
      weeklyLimit: { percentUsed: 70, resetsAt: 'Mon', isOutOfDate: true },
    });
  });
});
