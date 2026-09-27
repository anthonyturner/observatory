import type { AgentTool } from '../agent/agent-tool.ts';
import type { WebAnswer } from '../web-answer.ts';
import { requiredText } from './tool-args.ts';

/** Looks something up on the web, with the pages the answer drew on for the reply to list. */
export const webSearchTool = (search: (query: string) => Promise<WebAnswer>): AgentTool => ({
  name: 'web_search',
  description:
    'Look something up on the web: news, recent releases, prices, or anything current or that ' +
    'you are unsure of. Returns a short answer from fresh results, and the pages it drew on, ' +
    'which the page lists itself.',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string', description: 'What to look up, as a question.' } },
    required: ['query'],
  },
  run: async (args) => {
    const { text, sources } = await search(requiredText(args, 'query'));
    return { content: { answer: text, sources: sources.map((each) => each.title) }, sources };
  },
});
