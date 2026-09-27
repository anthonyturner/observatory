import type { IssuesReport } from '../../issues/issues-report.ts';
import type { AgentTool } from '../agent/agent-tool.ts';
import { ONE_PROJECT } from './project-schema.ts';
import { clipped, requiredProject } from './tool-args.ts';

/** The most issues listed back to the model, most recently touched first. */
export const MAX_ISSUES_LISTED = 20;
const TITLE_MAX = 120;

/** One project's open issues. */
export const projectIssuesTool = (issues: (repo: string) => Promise<IssuesReport>): AgentTool => ({
  name: 'project_issues',
  description: "One project's open issues, most recently touched first: number and title.",
  parameters: ONE_PROJECT,
  run: async (args, context) => {
    const project = requiredProject(args, 'project', context);
    const report = await issues(project.repo);
    return {
      content: {
        project: project.name,
        issues: report.open.slice(0, MAX_ISSUES_LISTED).map((issue) => ({
          number: issue.number,
          title: clipped(issue.title, TITLE_MAX),
        })),
        total: report.total.open,
      },
    };
  },
});
