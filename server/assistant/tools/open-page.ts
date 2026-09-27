import { actionReply } from '../action-reply.ts';
import { ACTABLE_IDS, ACTIONS, type ActableId } from '../actions.ts';
import type { AgentTool, ToolResult } from '../agent/agent-tool.ts';
import type { ActionReply, AskReply } from '../route-contract.ts';
import { PROJECT_ARG } from './project-schema.ts';
import { ToolArgError, optionalProject, requiredText } from './tool-args.ts';

/** The actions that open a page, as opposed to the ops the page runs itself. */
const PAGES = ACTABLE_IDS.filter((id) => !('op' in ACTIONS[id]));

const isPage = (id: string): id is ActableId => (PAGES as readonly string[]).includes(id);

const targetsDescribed = PAGES.map((id) => `${id}: ${ACTIONS[id].says}`).join('; ');

/** Where an action went, for the model to read; or why it went nowhere. */
function resultOf(reply: ActionReply | AskReply): ToolResult {
  if ('href' in reply) {
    return { content: { opening: reply.says }, effect: { kind: 'action', reply } };
  }
  if ('text' in reply) throw new ToolArgError(reply.text);
  throw new ToolArgError('That page needs a project: ask the owner which one.');
}

/** Opens one of the dashboard's pages, checked against the app's own actions. */
export const openPageTool: AgentTool = {
  name: 'open_page',
  description:
    'Open a page of the dashboard for the owner. Use it only when they ask to see or go to ' +
    `one. Targets: ${targetsDescribed}.`,
  parameters: {
    type: 'object',
    properties: { target: { type: 'string', enum: PAGES }, project: PROJECT_ARG },
    required: ['target'],
  },
  run: async (args, context) => {
    const target = requiredText(args, 'target');
    if (!isPage(target)) throw new ToolArgError(`No such page. Targets: ${PAGES.join(', ')}`);
    const project = optionalProject(args, 'project', context);
    return resultOf(actionReply(target, project, context.projects));
  },
};
