import { AgentRun } from '../../../../core/agent-usage/agent-usage-document';
import { groupOf } from '../../../../core/agent-usage/agent-groups';
import { formatTokens } from '../../../../core/usage/usage-format';
import { ChartText, tenth } from '../../../../shared/charts/chart-marks';
import { groupTotals } from './agent-stats';

export interface GridCell {
  readonly project: string;
  readonly agent: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill: string;
  /** Dark text on the brightest cells, light on the rest, so figures stay readable. */
  readonly ink: 'dark' | 'light';
  readonly label: string;
  readonly tip: string;
  readonly isPicked: boolean;
}

export interface ProjectGrid {
  readonly width: number;
  readonly height: number;
  readonly columns: readonly ChartText[];
  readonly rows: readonly ChartText[];
  readonly cells: readonly GridCell[];
}

const WIDTH = 520;
const LEFT = 96;
const RIGHT = 8;
const TOP = 30;
const CELL = 32;
/** More projects than this and the columns would be too narrow to read. */
const MAX_PROJECTS = 5;
const STEPS = 8;
/** From this step up a cell is bright enough to need dark figures. */
const DARK_INK_FROM = 6;

const shortName = (project: string): string =>
  project.length > 13 ? `${project.slice(0, 12)}…` : project;

/** E: work tokens per agent and project, the busiest projects first. */
export function projectGrid(
  runs: readonly AgentRun[],
  picked: { project: string | null; agent: string | null },
): ProjectGrid {
  const workOf = (mine: readonly AgentRun[]): number =>
    mine.reduce((total, run) => total + run.workTokens, 0);
  const projects = [...new Set(runs.map((run) => run.project))]
    .map((project) => ({ project, work: workOf(runs.filter((run) => run.project === project)) }))
    .sort((a, b) => b.work - a.work)
    .slice(0, MAX_PROJECTS)
    .map((each) => each.project);
  const groups = groupTotals(runs);
  const cellWidth = (WIDTH - LEFT - RIGHT) / Math.max(1, projects.length);
  const cells = groups.flatMap((totals, row) =>
    projects.map((project, column) => {
      const mine = runs.filter(
        (run) => run.project === project && groupOf(run.agent).id === totals.group.id,
      );
      return { totals, project, row, column, mine, work: workOf(mine) };
    }),
  );
  const most = Math.max(1, ...cells.map((cell) => cell.work));
  return {
    width: WIDTH,
    height: TOP + groups.length * CELL + 8,
    columns: projects.map((project, column) => ({
      x: tenth(LEFT + column * cellWidth + cellWidth / 2),
      y: TOP - 12,
      text: shortName(project),
      anchor: 'middle',
    })),
    rows: groups.map((totals, row) => ({
      x: LEFT - 12,
      y: TOP + row * CELL + CELL / 2 + 4,
      text: totals.group.label,
      anchor: 'end',
    })),
    cells: cells.map(({ totals, project, row, column, mine, work }) => {
      // The square root keeps one busy cell from washing the rest out.
      const step = work ? Math.min(STEPS, Math.ceil(Math.sqrt(work / most) * STEPS)) : 0;
      return {
        project,
        agent: totals.group.id,
        x: tenth(LEFT + column * cellWidth + 1),
        y: TOP + row * CELL + 1,
        width: tenth(cellWidth - 2),
        height: CELL - 2,
        fill: step ? `var(--agent-heat-${step})` : 'var(--agent-heat-empty)',
        ink: step >= DARK_INK_FROM ? 'dark' : 'light',
        label: work ? formatTokens(work) : '',
        tip: work
          ? `${totals.group.label} · ${project}\n${formatTokens(work)} work tokens · ${mine.length} runs\nClick to filter the charts to it`
          : `${totals.group.label} · ${project}\nNever ran here`,
        isPicked: picked.project === project && picked.agent === totals.group.id,
      };
    }),
  };
}
