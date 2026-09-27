import { jevAgent } from './agent/jev-agent.ts';
import { toolRegistry } from './agent/tool-registry.ts';
import { type AssistantRouter, assistantRouter } from './assistant-router.ts';
import { openRouter } from './open-router.ts';
import { projectsOf } from './projects-of.ts';
import { proposer } from './proposal.ts';
import type { ProposalRunner, Where } from './route-contract.ts';
import type { Shell } from './shell-commands.ts';
import type { SkillSource } from './skills-table.ts';
import { type AgentToolSources, agentTools } from './tools/agent-tools.ts';

export interface JevAssistantOptions {
  /** The OpenRouter key, or null for none: Jev is then off. */
  readonly key: string | null;
  readonly reads: AgentToolSources['reads'];
  readonly skills: SkillSource;
  readonly where: Where;
  /** The shells a tier-3 command is written for. */
  readonly shells: readonly Shell[];
  /** What turns a proposal into a run; null where nothing can. */
  readonly runner: ProposalRunner | null;
}

/** Home's assistant, put together from its parts: the same here and hosted,
 *  with different reads, skills, shells and runner. */
export function jevAssistant(options: JevAssistantOptions): AssistantRouter {
  const { reads } = options;
  const proposals = proposer({ shells: options.shells, runner: options.runner });
  const agent = jevAgent({
    models: openRouter({ key: options.key }),
    tools: toolRegistry(agentTools({ reads, proposals })),
  });
  return assistantRouter({
    agent,
    projects: async () => projectsOf(await reads.projects()),
    skills: options.skills,
    where: options.where,
    proposals,
  });
}
