import { TranscriptEntry } from '../runs/transcript/transcript.types';
import { LiveAgentsGap } from './live-agents.types';

/** One read of an agent's feed, as `GET /api/live-agents/feed` returns it. */
export interface AgentFeedPage {
  /** Claude Code stream-json events, `{ type, message: { content } }`, which
   *  the run transcript reads; checked there, as every event it reads is. */
  readonly events: readonly unknown[];
  /** Where to read from next; null when no transcript has the agent's ids. */
  readonly next: number | null;
  /** These events start the feed afresh rather than follow what came before. */
  readonly isRestart: boolean;
}

/** A read of the feed, or why there is none. */
export type AgentFeedRead =
  | Exclude<LiveAgentsGap, { status: 'reading' }>
  | { readonly status: 'ready'; readonly page: AgentFeedPage };

/** What the Activity tab shows: the agent's transcript so far, or why not. */
export type ActivityState =
  LiveAgentsGap | { readonly status: 'ready'; readonly entries: readonly TranscriptEntry[] };
