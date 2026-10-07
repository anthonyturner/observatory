/** Where an agent stands, as the local API reads it from its transcript. */
export type LiveAgentState = 'working' | 'waiting' | 'quiet' | 'not-running';

/** One Claude Code session or subagent, as `GET /api/live-agents` returns it. */
export interface LiveAgent {
  readonly session: string;
  /** The subagent's id, or null for the session itself. */
  readonly agentId: string | null;
  /** The subagent's agent (`ux`), or null for a session. */
  readonly agent: string | null;
  readonly title: string;
  readonly project: string;
  readonly repo: string | null;
  readonly branch: string | null;
  readonly folder: string;
  readonly state: LiveAgentState;
  readonly quietMinutes: number | null;
  /** An ISO time. */
  readonly lastActiveAt: string;
  readonly lastTool: string | null;
  readonly isHeadless: boolean;
}

/** The ids that name one agent: a session's, or one of its subagents'. */
export interface LiveAgentKey {
  readonly session: string;
  readonly agentId: string | null;
}

/** Why there is nothing to show yet, shared by the list and one agent. Only
 *  this machine's server reads transcripts; the hosted site has no such route. */
export type LiveAgentsGap =
  | { readonly status: 'reading' }
  | { readonly status: 'local-only' }
  | { readonly status: 'unreachable' };

export type LiveAgentsState =
  LiveAgentsGap | { readonly status: 'ready'; readonly agents: readonly LiveAgent[] };

/** One agent: found, running or not, or named by ids no transcript has. */
export type OneAgentState =
  LiveAgentsGap | { readonly status: 'ready'; readonly agent: LiveAgent | null };
