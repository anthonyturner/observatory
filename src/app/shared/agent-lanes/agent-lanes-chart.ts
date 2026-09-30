import { groupOf } from '../../core/agent-usage/agent-groups';
import { AgentRun } from '../../core/agent-usage/agent-usage-document';
import { formatTokens } from '../../core/usage/usage-format';
import { ChartLine, ChartText, tenth } from '../charts/chart-marks';

/** Which change the lanes are for: an issue, and its pull request where there is one. */
export interface LanesFor {
  readonly repo: string;
  readonly issue: number | null;
  /** Its pull requests: a review names its pull request, not the issue. */
  readonly pulls?: readonly number[];
}

export interface Lane {
  readonly id: string;
  readonly agent: string;
  readonly colour: string;
  readonly y: number;
  readonly x: number;
  readonly width: number;
  readonly label: ChartText;
  /** A label inside its bar wears dark ink, to read on the bar's colour. */
  readonly labelInside: boolean;
  /** A stage that ran before in this change: rework. */
  readonly isRepeat: boolean;
  readonly tip: string;
}

export interface LanesChart {
  readonly width: number;
  readonly height: number;
  readonly labelX: number;
  readonly lanes: readonly Lane[];
  readonly grid: readonly ChartLine[];
  readonly axis: readonly ChartText[];
  /** Dashed hand-offs from one run's end to the next one's start. */
  readonly handoffs: readonly string[];
  readonly totalTokens: string;
  readonly span: string;
}

const WIDTH = 640;
const LEFT = 92;
const RIGHT = 12;
const TOP = 6;
const ROW = 30;
const AXIS = 24;
const TICKS = 4;
const BAR = 16;
/** A label's 10.5px monospaced letters are each this wide, near enough, and
 *  it keeps this much clear of its bar. */
const CHAR_WIDTH = 6.4;
const LABEL_GAP = 6;
const MIN_BAR = 3;
const DESCRIPTION_LENGTH = 34;

/** A branch named for its issue, as this workflow names them: `<type>/<n>-<topic>`. */
const BRANCH_ISSUE = /^[a-z]+\/(\d+)-/i;

/** The issue a branch is named for, or null. */
export function issueFromBranch(branch: string | null): number | null {
  const match = BRANCH_ISSUE.exec(branch ?? '');
  return match ? Number(match[1]) : null;
}

/** The runs that worked on a change, oldest first: tied by the server to its
 *  issue (from the task or the branch), or naming its pull request in the task. */
export function runsFor(runs: readonly AgentRun[], target: LanesFor): AgentRun[] {
  const { issue, pulls = [] } = target;
  if (issue === null && !pulls.length) return [];
  const repo = target.repo.toLowerCase();
  return runs
    .filter(
      (run) =>
        run.repo?.toLowerCase() === repo &&
        ((issue !== null && run.issue === issue) ||
          (run.pull !== null && pulls.includes(run.pull))),
    )
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

const clock = (epochMs: number, withDay: boolean): string => {
  const date = new Date(epochMs);
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return withDay
    ? `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`
    : time;
};

const minutesOf = (ms: number): string =>
  ms < 60_000
    ? `${Math.round(ms / 1000)} s`
    : ms < 3_600_000
      ? `${Math.round(ms / 60_000)} min`
      : `${(ms / 3_600_000).toFixed(1)} h`;

const short = (text: string): string =>
  text.length > DESCRIPTION_LENGTH ? `${text.slice(0, DESCRIPTION_LENGTH - 1)}…` : text;

/** Where a bar's label fits: after it, else before it (clear of the agent names),
 *  else inside a bar wide enough to hold it, else on whichever side has more room. */
function labelFor(
  text: string,
  start: number,
  width: number,
  y: number,
): { label: ChartText; inside: boolean } {
  const need = text.length * CHAR_WIDTH + LABEL_GAP * 2;
  const roomAfter = WIDTH - RIGHT - (start + width);
  const roomBefore = start - LEFT;
  const after = { x: tenth(start + width + LABEL_GAP), y, text, anchor: 'start' as const };
  const before = { x: tenth(start - LABEL_GAP), y, text, anchor: 'end' as const };
  if (roomAfter >= need) return { label: after, inside: false };
  if (roomBefore >= need) return { label: before, inside: false };
  if (width >= need) {
    return { label: { x: tenth(start + LABEL_GAP), y, text, anchor: 'start' }, inside: true };
  }
  return { label: roomAfter >= roomBefore ? after : before, inside: false };
}

/** D: one change's runs on a timeline, a row each, so a repeated stage shows as rework. */
export function lanesChart(runs: readonly AgentRun[]): LanesChart | null {
  if (!runs.length) return null;
  const starts = runs.map((run) => Date.parse(run.startedAt));
  const ends = runs.map((run) => Date.parse(run.endedAt));
  const first = Math.min(...starts);
  const last = Math.max(...ends, first + 60_000);
  const plotWidth = WIDTH - LEFT - RIGHT;
  const x = (at: number): number => tenth(LEFT + ((at - first) / (last - first)) * plotWidth);
  const plotHeight = runs.length * ROW;
  const withDay = new Date(first).toDateString() !== new Date(last).toDateString();
  const ticks = Array.from(
    { length: TICKS + 1 },
    (_, index) => first + ((last - first) / TICKS) * index,
  );
  const seen = new Set<string>();
  const lanes = runs.map((run, index): Lane => {
    const group = groupOf(run.agent);
    const isRepeat = seen.has(group.id) && group.id !== 'other';
    seen.add(group.id);
    const start = x(starts[index]);
    const width = Math.max(MIN_BAR, x(ends[index]) - start);
    const y = TOP + index * ROW + ROW / 2;
    const text = `${isRepeat ? '↻ ' : ''}${formatTokens(run.workTokens)} · ${short(run.description || run.agent)}`;
    const { label, inside } = labelFor(text, start, width, y + 4);
    return {
      id: run.id,
      agent: run.agent,
      colour: group.colour,
      y,
      x: start,
      width: tenth(width),
      label,
      labelInside: inside,
      isRepeat,
      tip: [
        `${run.agent}${isRepeat ? ' · ran again (rework)' : ''}`,
        run.description,
        `${clock(starts[index], withDay)}–${clock(ends[index], false)} · ${minutesOf(ends[index] - starts[index])}`,
        `${formatTokens(run.workTokens)} work tokens · peak context ${formatTokens(run.peakContext)}`,
        `${run.toolUses} tool uses`,
      ]
        .filter(Boolean)
        .join('\n'),
    };
  });
  return {
    width: WIDTH,
    height: TOP + plotHeight + AXIS,
    labelX: LEFT - 10,
    lanes,
    grid: ticks.map((tick) => ({ x1: x(tick), x2: x(tick), y1: TOP, y2: TOP + plotHeight })),
    axis: ticks.map((tick, index) => ({
      x: x(tick),
      y: TOP + plotHeight + 16,
      text: clock(tick, withDay && (index === 0 || index === TICKS)),
      anchor: index === 0 ? 'start' : index === TICKS ? 'end' : 'middle',
    })),
    handoffs: lanes.slice(1).map((lane, index) => {
      const before = lanes[index];
      const fromX = before.x + before.width;
      const fromY = before.y + BAR / 2;
      const toY = lane.y - BAR / 2;
      return `M ${fromX} ${fromY} C ${fromX + 12} ${fromY}, ${lane.x - 12} ${toY}, ${lane.x} ${toY}`;
    }),
    totalTokens: formatTokens(runs.reduce((total, run) => total + run.workTokens, 0)),
    span: minutesOf(last - first),
  };
}
