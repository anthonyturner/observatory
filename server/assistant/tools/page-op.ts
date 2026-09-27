import type { AgentTool } from '../agent/agent-tool.ts';
import type { ActionReply } from '../route-contract.ts';

const NO_ARGS = { type: 'object', properties: {} } as const;

/** Something the page does itself, such as refresh, as a tool Jev can call. */
interface PageOpTool {
  readonly name: string;
  readonly description: string;
  readonly reply: ActionReply;
  /** What the model reads back once it is asked for. */
  readonly done: string;
}

const pageOpTool = (op: PageOpTool): AgentTool => ({
  name: op.name,
  description: op.description,
  parameters: NO_ARGS,
  run: async () => ({ content: { done: op.done }, effect: { kind: 'action', reply: op.reply } }),
});

export const refreshTool = pageOpTool({
  name: 'refresh',
  description: 'Refresh every project on the dashboard from GitHub now.',
  reply: { tier: 1, action: 'refresh', op: 'refresh' },
  done: 'The page will refresh every project and say how it went.',
});

export const showHelpTool = pageOpTool({
  name: 'show_help',
  description: "Open the dashboard's help card, which explains what is on the page.",
  reply: { tier: 1, action: 'help', op: 'help' },
  done: 'The page will open its help card.',
});
