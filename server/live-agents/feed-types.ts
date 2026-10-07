/** A tool's input as the feed sends it: plain JSON, every string cut short. */
export type FeedValue =
  string | number | boolean | null | readonly FeedValue[] | { readonly [key: string]: FeedValue };

export interface FeedText {
  readonly type: 'text';
  readonly text: string;
}

export interface FeedToolUse {
  readonly type: 'tool_use';
  readonly id: string;
  readonly name: string;
  readonly input: { readonly [key: string]: FeedValue };
}

export interface FeedToolResult {
  readonly type: 'tool_result';
  readonly tool_use_id: string;
  readonly is_error: boolean;
  readonly content: string;
}

export type FeedBlock = FeedText | FeedToolUse | FeedToolResult;

/** One transcript line, kept to what the Activity tab shows, in the shape of
 *  Claude Code's own stream-json so the run transcript reads it unchanged. */
export interface FeedEvent {
  readonly type: 'assistant' | 'user';
  readonly message: { readonly content: string | readonly FeedBlock[] };
}

/** What `GET /api/live-agents/feed` returns. */
export interface AgentFeedPage {
  readonly events: readonly FeedEvent[];
  /** The byte offset to ask `from` next; null when no transcript has the ids. */
  readonly next: number | null;
  /** These events start the feed afresh: a first load, or a transcript now
   *  shorter than the cursor, as one written anew would be. */
  readonly isRestart: boolean;
}
