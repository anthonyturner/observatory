import { localDayKey, workTokens } from './token-days.ts';
import type { AssistantMessage, ProjectUsage } from './usage-types.ts';

/** Which project a working directory belongs to. */
export interface ProjectRef {
  readonly name: string;
  /** "owner/name" on GitHub, or null for a folder that is no repository. */
  readonly repo: string | null;
}

export type ProjectOf = (cwd: string) => ProjectRef;

/** Of the folders that are no repository, only the busiest keep a row. */
export const TOP_FOLDERS = 10;

interface ProjectTally {
  readonly name: string;
  readonly repo: string | null;
  tokens: number;
  cacheRead: number;
  messages: number;
  readonly sessions: Set<string>;
  readonly daily: number[];
}

const keyOf = (project: ProjectRef): string => project.repo ?? `~${project.name}`;

function tallyOf(tallies: Map<string, ProjectTally>, project: ProjectRef, days: number) {
  const key = keyOf(project);
  const had = tallies.get(key);
  if (had) return had;
  const tally: ProjectTally = {
    ...project,
    tokens: 0,
    cacheRead: 0,
    messages: 0,
    sessions: new Set(),
    daily: new Array<number>(days).fill(0),
  };
  tallies.set(key, tally);
  return tally;
}

/** Folders past the busiest few become one row, so a machine full of scratch
 *  folders cannot grow the report. Repositories always keep their own. */
export function foldFolders(projects: readonly ProjectUsage[]): ProjectUsage[] {
  const rest = projects.filter((project) => !project.repo).slice(TOP_FOLDERS);
  if (!rest.length) return [...projects];
  const days = rest[0].daily.length;
  const other: ProjectUsage = {
    name: `${rest.length} other folders`,
    repo: null,
    folded: rest.length,
    tokens: rest.reduce((total, project) => total + project.tokens, 0),
    cacheRead: rest.reduce((total, project) => total + project.cacheRead, 0),
    messages: rest.reduce((total, project) => total + project.messages, 0),
    sessions: rest.reduce((total, project) => total + project.sessions, 0),
    daily: Array.from({ length: days }, (_, day) =>
      rest.reduce((total, project) => total + (project.daily[day] ?? 0), 0),
    ),
  };
  return [...projects.filter((project) => !rest.includes(project)), other];
}

/** Each project's use over `days` (local day keys, oldest first), busiest first. */
export function projectUsage(
  messages: readonly AssistantMessage[],
  projectOf: ProjectOf,
  days: readonly string[],
): ProjectUsage[] {
  const index = new Map(days.map((day, position) => [day, position]));
  const tallies = new Map<string, ProjectTally>();
  for (const message of messages) {
    const day = index.get(localDayKey(message.at));
    if (day === undefined) continue;
    const tally = tallyOf(tallies, projectOf(message.cwd), days.length);
    tally.tokens += workTokens(message);
    tally.cacheRead += message.cacheRead;
    tally.messages++;
    if (message.session) tally.sessions.add(message.session);
    tally.daily[day] += workTokens(message);
  }
  const projects = [...tallies.values()]
    .map(({ sessions, ...tally }) => ({ ...tally, sessions: sessions.size }))
    .sort((a, b) => b.tokens - a.tokens);
  return foldFolders(projects);
}
