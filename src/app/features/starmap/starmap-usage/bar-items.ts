import { Frame } from '../../../core/queue/history-report';
import { ProjectUsage, ToolCount } from '../../../core/usage/usage-document';
import { formatTokens, localDayKey } from '../../../core/usage/usage-format';
import { fmtN } from '../starmap-view';
import { BarItem } from './charts/bar-rows-chart';

/** The busiest projects shown by name; the rest share one row. */
const TOP_PROJECTS = 8;

/** The project the page is for, if it ran any sessions. */
export const projectFor = (projects: readonly ProjectUsage[], repo: string): ProjectUsage | null =>
  projects.find((project) => project.repo?.toLowerCase() === repo.toLowerCase()) ?? null;

const projectTip = (project: ProjectUsage): string =>
  [
    project.repo ?? project.name,
    `${formatTokens(project.tokens)} tokens · ${formatTokens(project.cacheRead)} cache reads`,
    `${fmtN(project.messages)} replies · ${project.sessions} sessions`,
  ].join('\n');

/** The busiest projects as bars, this page's one kept and lit among them. */
export function projectBars(projects: readonly ProjectUsage[], repo: string): BarItem[] {
  const mine = projectFor(projects, repo);
  const top = projects.slice(0, TOP_PROJECTS);
  if (mine && !top.includes(mine)) top.push(mine);
  const rest = projects.filter((project) => !top.includes(project));
  const items: BarItem[] = top.map((project) => ({
    label: project.name,
    value: project.tokens,
    text: formatTokens(project.tokens),
    isStrong: !mine || project === mine,
    tip: projectTip(project),
  }));
  if (!rest.length) return items;
  const tokens = rest.reduce((total, project) => total + project.tokens, 0);
  return [
    ...items,
    {
      label: `${rest.length} more`,
      value: tokens,
      text: formatTokens(tokens),
      isStrong: !mine,
      tip: rest.map((project) => `${project.name} ${formatTokens(project.tokens)}`).join('\n'),
    },
  ];
}

export const toolBars = (tools: readonly ToolCount[]): BarItem[] =>
  tools.map((tool) => ({
    label: tool.name,
    value: tool.count,
    text: fmtN(tool.count),
    isStrong: true,
    tip: `${tool.name}\n${fmtN(tool.count)} calls`,
  }));

const dayOf = (frame: Frame): string => localDayKey(Date.parse(frame.at));

/** Pull requests the star map saw merge on or after `fromDay`, or null when
 *  its memory does not reach back that far: a partial count would read as
 *  fewer merges than there were. */
export function mergesSince(frames: readonly Frame[], fromDay: string): number | null {
  const reachesBack = frames.some((frame) => dayOf(frame) <= fromDay);
  if (!reachesBack) return null;
  return frames
    .filter((frame) => dayOf(frame) >= fromDay)
    .flatMap((frame) => frame.departed)
    .filter((departed) => departed.fate === 'merged').length;
}

export interface ProjectNoteInput {
  readonly projects: readonly ProjectUsage[];
  readonly repo: string;
  readonly days: number;
  /** Merges over the same days, or null when the star map has no memory to count them from. */
  readonly merges: number | null;
}

/** Tokens set against what they bought here, or that nothing ran here. */
export function projectNote({ projects, repo, days, merges }: ProjectNoteInput): string | null {
  const mine = projectFor(projects, repo);
  if (!mine) return repo ? `No sessions ran in ${repo} in these days.` : null;
  if (merges === null) return null;
  const each = merges ? `, about ${formatTokens(mine.tokens / merges)} tokens a merge` : '';
  return (
    `${mine.name}: ${formatTokens(mine.tokens)} tokens over ${days} days, and ` +
    `${fmtN(merges)} pull request${merges === 1 ? '' : 's'} merged${each}.`
  );
}
