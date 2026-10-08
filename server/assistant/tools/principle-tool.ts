import { principleOfDay } from '../../principles/principle-of-day.ts';
import type { AgentTool } from '../agent/agent-tool.ts';

const NO_ARGS = { type: 'object', properties: {} } as const;

/** Today's software-design principle, the one Home's card shows. */
export const principleOfDayTool = (now: () => Date = () => new Date()): AgentTool => ({
  name: 'principle_of_the_day',
  description:
    "Today's software-design principle from John Ousterhout's A Philosophy of Software Design: " +
    'its title, what it means, and a question for the owner to reflect on today.',
  parameters: NO_ARGS,
  run: async () => {
    const { title, idea, question } = principleOfDay(now());
    return { content: { title, idea, question } };
  },
});
