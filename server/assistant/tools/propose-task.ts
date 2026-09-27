import type { AgentTool, ToolResult } from '../agent/agent-tool.ts';
import type { Proposer } from '../proposal.ts';
import { type AskReply, MAX_REQUEST_LENGTH, type Proposal } from '../route-contract.ts';
import { PROJECT_ARG } from './project-schema.ts';
import { ToolArgError, optionalProject, requiredText } from './tool-args.ts';

function resultOf(reply: Proposal | AskReply): ToolResult {
  if ('question' in reply) {
    const names = reply.ask.map((choice) => choice.label).join(', ');
    throw new ToolArgError(`Ask the owner which project it should run in: ${names}.`);
  }
  return {
    content: {
      proposed: true,
      project: reply.project,
      canRunHere: Boolean(reply.run),
      ...(reply.runWhy ? { whyNotHere: reply.runWhy } : {}),
    },
    effect: { kind: 'proposal', proposal: reply },
  };
}

/** Proposes work in a project as a Claude Code task. It is only ever a
 *  proposal: the owner presses Run, or copies the command. */
export const proposeTaskTool = (proposals: Proposer): AgentTool => ({
  name: 'propose_task',
  description:
    'Propose a Claude Code task for work in one of the projects: reading or changing code or ' +
    'files, running commands, or handling pull requests or issues. It only shows the owner a ' +
    'card; nothing runs until they press Run.',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'The task, as instructions to Claude Code.' },
      project: PROJECT_ARG,
    },
    required: ['prompt'],
  },
  run: async (args, context) => {
    const prompt = requiredText(args, 'prompt');
    if (prompt.length > MAX_REQUEST_LENGTH) {
      throw new ToolArgError(`The prompt must be at most ${MAX_REQUEST_LENGTH} characters.`);
    }
    const project = optionalProject(args, 'project', context);
    return resultOf(await proposals.propose({ prompt, project, projects: context.projects }));
  },
});
