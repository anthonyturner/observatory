import { plural } from '../../shared/text/plural';
import { LiveAgent, LiveAgentKey, LiveAgentState } from './live-agents.types';

/** What needs the reader first: an agent waiting on them, then busy ones, then quiet ones. */
const STATE_ORDER: Readonly<Record<LiveAgentState, number>> = {
  waiting: 0,
  working: 1,
  quiet: 2,
  'not-running': 3,
};

/** Waiting first, then working, then quiet; the latest activity first within each. */
export function inListOrder(agents: readonly LiveAgent[]): LiveAgent[] {
  return [...agents].sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] || b.lastActiveAt.localeCompare(a.lastActiveAt),
  );
}

/** "Working", "Waiting for you", "Quiet 14 min", "Not running". */
export function stateText(agent: Pick<LiveAgent, 'state' | 'quietMinutes'>): string {
  switch (agent.state) {
    case 'working':
      return 'Working';
    case 'waiting':
      return 'Waiting for you';
    case 'quiet':
      return `Quiet ${agent.quietMinutes ?? 0} min`;
    case 'not-running':
      return 'Not running';
  }
}

/** The agent's page: `/agents/<session>`, or `/agents/<session>/<subagent>`. */
export function agentLink(key: LiveAgentKey): readonly string[] {
  return key.agentId ? ['/agents', key.session, key.agentId] : ['/agents', key.session];
}

/** What a badge counts: the agents running, and how many wait on the reader. */
export interface RunningCount {
  readonly running: number;
  readonly waiting: number;
}

/** The running agents in `repo` (owner/name, any case), or in all when it is null. */
export function runningCount(agents: readonly LiveAgent[], repo: string | null): RunningCount {
  const wanted = repo?.toLowerCase() ?? null;
  const mine = agents.filter((agent) => wanted === null || agent.repo?.toLowerCase() === wanted);
  return {
    running: mine.length,
    waiting: mine.filter((agent) => agent.state === 'waiting').length,
  };
}

/** "Agents, 3 running, 1 waiting for you": what a badge link is called. */
export function countName(label: string, count: RunningCount): string {
  const parts = [label];
  if (count.running) parts.push(`${count.running} running`);
  if (count.waiting) parts.push(`${count.waiting} waiting for you`);
  return parts.join(', ');
}

/** "subagent ux" for a subagent, "session" for a session. */
export function kindText(agent: Pick<LiveAgent, 'agent' | 'agentId'>): string {
  return agent.agentId ? `subagent ${agent.agent ?? 'unknown'}` : 'session';
}

/** The title, or what stands in for a session Claude Code has not named yet. */
export const titleText = (agent: Pick<LiveAgent, 'title' | 'agentId'>): string =>
  agent.title || (agent.agentId ? 'Untitled subagent' : 'Untitled session');

const FOLDER_PARTS = /[\\/]/;

/** `…\observatory-wt-490`: the folder's last part, which tells checkouts apart. */
export function shortFolder(folder: string): string {
  const parts = folder.split(FOLDER_PARTS).filter(Boolean);
  if (parts.length < 2) return folder;
  const separator = folder.includes('\\') ? '\\' : '/';
  return `…${separator}${parts[parts.length - 1]}`;
}

export interface RowIds {
  readonly title: string;
  readonly state: string;
  readonly project: string;
  readonly ago: string;
}

/** One row of the agents list, ready to render. */
export interface AgentRow {
  /** Unique on the page. */
  readonly id: string;
  readonly link: readonly string[];
  /** The element ids of the parts the row's link is named by. */
  readonly ids: RowIds;
  /** Those ids in the order the link is named by them: title, state, project, time. */
  readonly labelledBy: string;
  /** The subagent's agent (`ux`), or empty for a session. */
  readonly kicker: string;
  readonly title: string;
  readonly state: LiveAgentState;
  readonly stateText: string;
  readonly project: string;
  readonly folder: string;
  readonly shortFolder: string;
  readonly branch: string | null;
  readonly lastTool: string | null;
  readonly isHeadless: boolean;
  readonly lastActiveAt: string;
}

function rowOf(agent: LiveAgent): AgentRow {
  const id = `agent-${agent.session}${agent.agentId ? `-${agent.agentId}` : ''}`;
  const ids: RowIds = {
    title: `${id}-title`,
    state: `${id}-state`,
    project: `${id}-project`,
    ago: `${id}-ago`,
  };
  return {
    id,
    link: agentLink(agent),
    ids,
    labelledBy: [ids.title, ids.state, ids.project, ids.ago].join(' '),
    kicker: agent.agentId ? (agent.agent ?? 'unknown') : '',
    title: titleText(agent),
    state: agent.state,
    stateText: stateText(agent),
    project: agent.project,
    folder: agent.folder,
    shortFolder: shortFolder(agent.folder),
    branch: agent.branch,
    lastTool: agent.lastTool,
    isHeadless: agent.isHeadless,
    lastActiveAt: agent.lastActiveAt,
  };
}

/** The list's rows, in list order. */
export const rowsOf = (agents: readonly LiveAgent[]): AgentRow[] => inListOrder(agents).map(rowOf);

/** "3 agents running, 1 waiting for you.": what the page announces as it changes. */
export function summaryText(count: RunningCount): string {
  const running = `${plural(count.running, 'agent')} running`;
  return count.waiting ? `${running}, ${count.waiting} waiting for you.` : `${running}.`;
}

/** "This session isn't running. Last active 09:42." for an agent that has stopped. */
export function notRunningText(agent: LiveAgent, locale?: string): string {
  const kind = agent.agentId ? 'agent' : 'session';
  const at = new Date(agent.lastActiveAt);
  const time = at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `This ${kind} isn't running. Last active ${time}.`;
}
