import type { LimitWindow, TokenDay, UsageReport } from '../../usage/usage-types.ts';
import { familyTotal } from '../../usage/usage-breakdown.ts';
import type { AgentTool } from '../agent/agent-tool.ts';

const NO_ARGS = { type: 'object', properties: {} } as const;
const NOT_READ = 'No Claude Code usage has been read here yet.';

/** A limit as a percentage and its reset; one whose reset has passed is unknown. */
const limitLine = (window: LimitWindow | null) =>
  window && { percentUsed: window.pct, resetsAt: window.resetsAt, isOutOfDate: window.expired };

const dayLine = (day: TokenDay | undefined) =>
  day && { day: day.day, tokens: familyTotal(day), messages: day.messages, sessions: day.sessions };

/** Claude Code's tokens on the latest day read, and the plan's limits. */
export const usageSummaryTool = (usage: () => Promise<UsageReport | null>): AgentTool => ({
  name: 'usage_summary',
  description:
    "The owner's Claude Code usage: tokens on the latest day read, and how much of the " +
    'five-hour and weekly plan limits is used.',
  parameters: NO_ARGS,
  run: async () => {
    const report = await usage();
    if (!report) return { content: { error: NOT_READ } };
    return {
      content: {
        latestDay: dayLine(report.tokens.rows.at(-1)) ?? null,
        fiveHourLimit: limitLine(report.limits?.five ?? null),
        weeklyLimit: limitLine(report.limits?.week ?? null),
      },
    };
  },
});
