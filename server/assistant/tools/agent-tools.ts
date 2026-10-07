import type { ApiReads } from '../../app/api-reads.ts';
import type { AgentTool } from '../agent/agent-tool.ts';
import type { Proposer } from '../proposal.ts';
import type { WebAnswer } from '../web-answer.ts';
import { listProjectsTool } from './list-projects.ts';
import { openPageTool } from './open-page.ts';
import { refreshTool, showHelpTool } from './page-op.ts';
import { projectIssuesTool } from './project-issues.ts';
import { projectPullRequestsTool } from './project-pull-requests.ts';
import { proposeTaskTool } from './propose-task.ts';
import { queueTools } from './queue-tools.ts';
import { usageSummaryTool } from './usage-summary.ts';
import { webSearchTool } from './web-search.ts';

/** What Jev's tools read, look up and propose through. */
export interface AgentToolSources {
  readonly reads: Pick<ApiReads, 'projects' | 'queue' | 'issues' | 'usage'>;
  readonly search: (query: string) => Promise<WebAnswer>;
  readonly proposals: Proposer;
}

/** Every tool Jev has. A new one is one more entry here. */
export function agentTools({ reads, search, proposals }: AgentToolSources): AgentTool[] {
  return [
    listProjectsTool(() => reads.projects()),
    projectPullRequestsTool((repo) => reads.queue(repo)),
    projectIssuesTool((repo) => reads.issues(repo)),
    usageSummaryTool(() => reads.usage()),
    webSearchTool(search),
    openPageTool,
    refreshTool,
    showHelpTool,
    proposeTaskTool(proposals),
    ...queueTools((repo) => reads.queue(repo)),
  ];
}
