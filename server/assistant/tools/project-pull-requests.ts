import type { QueueItem, QueueReport } from '../../queue/queue-report.ts';
import type { AgentTool } from '../agent/agent-tool.ts';
import { ONE_PROJECT } from './project-schema.ts';
import { clipped, requiredProject } from './tool-args.ts';

/** The most pull requests listed back to the model, most blocked first. */
export const MAX_PULLS_LISTED = 20;
const TITLE_MAX = 120;

const pullLine = (item: QueueItem) => ({
  number: item.number,
  title: clipped(item.title, TITLE_MAX),
  bucket: item.bucket,
  idleDays: item.idleDays,
  isDraft: item.isDraft,
  linksIssue: item.closes.length > 0,
});

/** One project's open pull requests, in the review queue's blocked-first order. */
export const projectPullRequestsTool = (
  queue: (repo: string) => Promise<QueueReport>,
): AgentTool => ({
  name: 'project_pull_requests',
  description:
    "One project's open pull requests, most blocked first: number, title, bucket (what blocks " +
    'it), days idle, and whether it links an issue.',
  parameters: ONE_PROJECT,
  run: async (args, context) => {
    const project = requiredProject(args, 'project', context);
    const report = await queue(project.repo);
    return {
      content: {
        project: project.name,
        pullRequests: report.items.slice(0, MAX_PULLS_LISTED).map(pullLine),
        total: report.items.length,
      },
    };
  },
});
