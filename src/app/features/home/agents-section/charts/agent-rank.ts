import { AgentRun } from '../../../../core/agent-usage/agent-usage-document';
import { formatTokens } from '../../../../core/usage/usage-format';
import { tenth } from '../../../../shared/charts/chart-marks';
import { agentTotals, formatMinutes, groupTip, groupTotals } from './agent-stats';

/** One agent's bar, longest first. */
export interface RankRow {
  readonly id: string;
  readonly label: string;
  readonly colour: string;
  readonly y: number;
  readonly barWidth: number;
  readonly value: string;
  readonly detail: string;
  readonly tip: string;
}

/** A table row: one agent's figures, every agent on its own, for reading without hovering. */
export interface RankTableRow {
  readonly id: string;
  readonly label: string;
  readonly colour: string;
  readonly runs: number;
  readonly tokens: string;
  readonly perRun: string;
  readonly peak: string;
  readonly toolUses: number;
  readonly perRunTime: string;
}

export interface RankChart {
  readonly width: number;
  readonly height: number;
  readonly labelX: number;
  readonly barX: number;
  readonly rowHeight: number;
  readonly rows: readonly RankRow[];
  readonly table: readonly RankTableRow[];
}

const WIDTH = 520;
const ROW = 36;
const LABEL_WIDTH = 150;
/** Room at the right for the figures after the longest bar. */
const FIGURES = 120;
const MIN_BAR = 4;

/** A: work tokens per agent, most first, with runs and the average a run. */
export function rankChart(runs: readonly AgentRun[]): RankChart {
  const totals = groupTotals(runs).sort((a, b) => b.workTokens - a.workTokens);
  // Floored, so a month whose busiest agent logged no tokens draws empty bars, not broken ones.
  const most = Math.max(1, totals[0]?.workTokens ?? 0);
  const room = WIDTH - LABEL_WIDTH - FIGURES;
  return {
    width: WIDTH,
    height: Math.max(ROW, totals.length * ROW),
    labelX: LABEL_WIDTH - 12,
    barX: LABEL_WIDTH,
    rowHeight: ROW,
    rows: totals.map((each, index) => ({
      id: each.group.id,
      label: each.group.label,
      colour: each.group.colour,
      y: index * ROW,
      barWidth: tenth(Math.max(MIN_BAR, (each.workTokens / most) * room)),
      value: formatTokens(each.workTokens),
      detail: `${each.runs.length} runs · ${formatTokens(each.averageWorkTokens)}/run`,
      tip: groupTip(each),
    })),
    table: agentTotals(runs).map((each) => ({
      id: each.agent,
      label: each.agent,
      colour: each.group.colour,
      runs: each.runs,
      tokens: formatTokens(each.workTokens),
      perRun: formatTokens(each.averageWorkTokens),
      peak: formatTokens(each.maxPeak),
      toolUses: each.toolUses,
      perRunTime: formatMinutes(each.averageMinutes),
    })),
  };
}
