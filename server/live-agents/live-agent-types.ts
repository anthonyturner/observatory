/** Where an agent stands, read from how recently and how its transcript was last written. */
export type LiveAgentState = 'working' | 'waiting' | 'quiet' | 'not-running';

/** One Claude Code session or subagent, as `GET /api/live-agents` returns it. */
export interface LiveAgent {
  readonly session: string;
  /** The subagent's id, or null for the session itself. */
  readonly agentId: string | null;
  /** The subagent's agent without its plugin namespace (`ux`), or null for a session. */
  readonly agent: string | null;
  /** The session's title, or the task a subagent was given; empty when neither is recorded. */
  readonly title: string;
  readonly project: string;
  readonly repo: string | null;
  readonly branch: string | null;
  /** The folder it last worked in, which can move within a session. */
  readonly folder: string;
  readonly state: LiveAgentState;
  /** Whole minutes since the last write, for a quiet agent; else null. */
  readonly quietMinutes: number | null;
  readonly lastActiveAt: string;
  /** The last tool it called and what at, as `Read src/app.ts`; null before any. */
  readonly lastTool: string | null;
  /** Started with `claude -p`, so nobody is at a terminal to answer it. */
  readonly isHeadless: boolean;
}

/** What `GET /api/live-agents` returns: the agents running now. */
export interface LiveAgentsReport {
  readonly generatedAt: string;
  readonly agents: readonly LiveAgent[];
}

/** What `GET /api/live-agents?session=` returns: that agent, running or not,
 *  or null when no transcript on this machine has its ids. */
export interface LiveAgentAnswer {
  readonly generatedAt: string;
  readonly agent: LiveAgent | null;
}

/** The ids that name one transcript: a session's, or one of its subagents'. */
export interface AgentKey {
  readonly session: string;
  readonly agentId: string | null;
}
