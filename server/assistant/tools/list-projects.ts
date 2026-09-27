import type { ProjectSnapshot, ProjectsReport } from '../../projects/project-types.ts';
import type { AgentTool } from '../agent/agent-tool.ts';

/** The most projects listed back to the model. */
export const MAX_PROJECTS_LISTED = 30;

const NO_ARGS = { type: 'object', properties: {} } as const;

/** One project, as few tokens as say where it stands. Unknown counts stay
 *  unknown: a project GitHub could not be read for says why, not zero. */
function projectLine(project: ProjectSnapshot) {
  if (project.error) return { name: project.name, repo: project.repo, error: project.error };
  const { counts } = project;
  return {
    name: project.name,
    repo: project.repo,
    openPullRequests: project.open,
    conflicted: counts.conflicted,
    failingChecks: counts.failing,
    mergeabilityUnknown: counts.unknown,
    noLinkedIssue: counts.unlinked,
    unreviewed: counts.unreviewed,
    ...(project.issues === undefined ? {} : { openIssues: project.issues }),
    unclaimedIssues: counts.unclaimed,
    ...(project.oldestIdleDays === undefined ? {} : { oldestIdleDays: project.oldestIdleDays }),
  };
}

/** Every project on the dashboard, with its open pull requests counted by bucket. */
export const listProjectsTool = (projects: () => Promise<ProjectsReport>): AgentTool => ({
  name: 'list_projects',
  description:
    "The owner's projects on the dashboard: each one's repository, open pull requests counted " +
    'by what blocks them, and open issues.',
  parameters: NO_ARGS,
  run: async () => {
    const report = await projects();
    return {
      content: {
        projects: report.projects.slice(0, MAX_PROJECTS_LISTED).map(projectLine),
        total: report.projects.length,
      },
    };
  },
});
